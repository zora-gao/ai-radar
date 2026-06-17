import pLimit from 'p-limit';

import type { ArchiveItem } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { summarizeTitle, type SummaryEntry } from './glm.js';

export type { SummaryEntry, RadarPriority, RadarType } from './glm.js';
export { summarizeTitle, RADAR_CHANNELS } from './glm.js';

const DEFAULT_CONCURRENCY = 5;

/**
 * enrich 逻辑版本号。提升后，低于该版本的旧缓存条目会被逐步（受 maxNew 预算限制）
 * 重新生成，使其享受新逻辑（如 v2：结合描述生成有意义的标题/摘要；
 * v3：摘要升级为 2~3 句、60~120 字、说清主要内容；
 * v4：product 标题强制「英文产品名：中文功能简述」格式、禁止音译、摘要必填，
 * 并清洗 "Discussion | Link" 等无效描述）。
 */
const ENRICH_VERSION = 4;

/** 缓存条目是否已包含 AI Radar 评分（用于判断旧缓存是否需要补评） */
function hasRadarScore(entry: SummaryEntry | undefined): boolean {
  return !!entry && typeof entry.score === 'number' && Number.isFinite(entry.score);
}

/** 缓存条目是否为当前版本（旧版本需重生成以应用新逻辑） */
function isCurrentVersion(entry: SummaryEntry | undefined): boolean {
  return !!entry && typeof entry.v === 'number' && entry.v >= ENRICH_VERSION;
}

/** 中日韩统一表意文字（用于判断产品标题是否已含中文功能描述） */
const CJK_RE = /[\u4e00-\u9fff]/;
/** 标题「英文名：功能简述」的分隔符（中文全角/英文半角冒号、破折号） */
const TITLE_SEP_RE = /[:：\-—]/;

/**
 * 产品类条目是否需要重新生成。命中任一即重生成，使其满足
 * 「英文产品名：中文功能简述」标题 + 必有摘要 的展示要求：
 *  - 缺 title_clean；
 *  - title_clean 不含中文（光秃英文名）；
 *  - title_clean 不含分隔符（只有产品名，无功能简述，如音译「奥博蒂克」）；
 *  - summary 为空或过短（无简要介绍）。
 */
function needsBetterProductTitle(entry: SummaryEntry | undefined): boolean {
  if (!entry || entry.type !== 'product') return false;
  const t = (entry.title_clean || '').trim();
  const summary = (entry.summary || '').trim();
  if (!t || !CJK_RE.test(t)) return true;
  if (!TITLE_SEP_RE.test(t)) return true;
  if (summary.length < 10) return true;
  return false;
}

/**
 * 清洗送入 GLM 的描述：Product Hunt 等源的劣质描述常只剩 "Discussion | Link"
 * 页脚，对生成毫无帮助。这类无效描述置空，促使模型走「据产品名推断品类」路径，
 * 而非被垃圾信息带偏。
 */
function sanitizeDescription(desc: string): string {
  const d = (desc || '').replace(/\s+/g, ' ').trim();
  if (/^(discussion|link)(\s*\|\s*(discussion|link))*$/i.test(d)) return '';
  return desc;
}

/**
 * 为资讯条目补充 title_clean / summary 及 AI Radar 准入评审字段（基于标题）。
 *
 * - 按 URL 缓存结果（增量：只对缓存里没有、或旧缓存缺评分的条目调用 LLM）
 * - 受 maxNew 预算限制，控制单次运行的调用量与耗时
 * - 未配置 GLM_API_KEY 时整体跳过（不报错，字段留空）
 * - 任意条目失败只影响该条，不阻塞整体
 */
export async function addSummaries(
  itemsAi: ArchiveItem[],
  itemsAll: ArchiveItem[],
  cache: Map<string, SummaryEntry>,
  maxNew: number,
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<{
  itemsAi: ArchiveItem[];
  itemsAll: ArchiveItem[];
  cache: Map<string, SummaryEntry>;
  generated: number;
}> {
  const apiKey = process.env.GLM_API_KEY?.trim() || '';

  // 收集需要新生成/补评的候选（按 itemsAi 顺序，URL 去重）
  // 命中条件：缓存缺失，或旧缓存仅有摘要但缺 radar 评分，或旧缓存为过期版本（需用新逻辑重生成）。
  //
  // 调度策略：
  //   - product（Product Hunt）条目走「专属配额」：全部纳入 todo，不受 maxNew 限制。
  //     产品 tab 是榜单展示，对完整度极敏感；漏处理就会出现「光秃英文名 + 空摘要」
  //     的违规卡片，伤害远大于多调几次 GLM 的成本。
  //   - 其余资讯（news/research/...）走 maxNew 预算，「v4 待重生成」的旧缓存排队首
  //     保证旧不达标先升级，新增条目排其后。
  const productMust: Array<{ url: string; title: string; description: string }> = [];
  const newsPriority: Array<{ url: string; title: string; description: string }> = [];
  const newsNormal: Array<{ url: string; title: string; description: string }> = [];
  const seen = new Set<string>();

  for (const it of itemsAi) {
    const url = normalizeUrl(it.url || '');
    if (!url || seen.has(url)) continue;

    const cached = cache.get(url);
    const needsTitle = needsBetterProductTitle(cached);
    if (cached && hasRadarScore(cached) && isCurrentVersion(cached) && !needsTitle) continue;

    // 改写标题需要原始英文标题与描述作上下文，避免把光秃秃的产品名直译
    const title = (it.title || it.title_en || it.title_zh || '').trim();
    if (!title) continue;

    seen.add(url);
    const candidate = {
      url,
      title,
      description: sanitizeDescription((it.description || '').trim()),
    };
    if (it.site_id === 'producthunt') {
      productMust.push(candidate);
    } else if (needsTitle) {
      newsPriority.push(candidate);
    } else {
      newsNormal.push(candidate);
    }
  }

  // 资讯类受 maxNew 预算限制；产品类全部必须处理（专属配额）
  const newsTodo = [...newsPriority, ...newsNormal].slice(0, Math.max(0, maxNew));
  const todo = apiKey ? [...productMust, ...newsTodo] : [];

  let generated = 0;
  if (todo.length > 0) {
    const limit = pLimit(concurrency);
    // 产品类强制处理时，单条失败做一次重试（限流偶发恢复后即成功），
    // 进一步降低产品 tab 出现违规卡片的概率。
    const productUrls = new Set(productMust.map((c) => c.url));
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await Promise.all(
      todo.map((c) =>
        limit(async () => {
          let entry = await summarizeTitle(c.title, c.description, apiKey);
          if (!entry && productUrls.has(c.url)) {
            await sleep(1500);
            entry = await summarizeTitle(c.title, c.description, apiKey);
          }
          if (entry && (entry.title_clean || entry.summary || hasRadarScore(entry))) {
            cache.set(c.url, { ...entry, v: ENRICH_VERSION });
            generated++;
          }
        })
      )
    );
  }

  const apply = (it: ArchiveItem): ArchiveItem => {
    const url = normalizeUrl(it.url || '');
    const entry = url ? cache.get(url) : undefined;
    if (!entry) return it;
    return {
      ...it,
      title_clean: entry.title_clean || null,
      summary: entry.summary || null,
      radar_score: typeof entry.score === 'number' ? entry.score : null,
      radar_priority: entry.priority || null,
      radar_type: entry.type || null,
      radar_channels: entry.channels && entry.channels.length ? entry.channels : null,
    };
  };

  return {
    itemsAi: itemsAi.map(apply),
    itemsAll: itemsAll.map(apply),
    cache,
    generated,
  };
}

/**
 * 从持久化的 POJO 载入 URL -> SummaryEntry 缓存。兼容旧版（仅含 title_clean/summary）。
 */
export function loadSummaryCache(
  data: Record<string, unknown>
): Map<string, SummaryEntry> {
  const cache = new Map<string, SummaryEntry>();
  if (!data || typeof data !== 'object') return cache;

  for (const [url, raw] of Object.entries(data)) {
    if (!url || typeof raw !== 'object' || raw === null) continue;
    const obj = raw as Record<string, unknown>;
    const titleClean = typeof obj.title_clean === 'string' ? obj.title_clean : '';
    const summary = typeof obj.summary === 'string' ? obj.summary : '';
    const score =
      typeof obj.score === 'number' && Number.isFinite(obj.score) ? obj.score : null;
    const priority =
      obj.priority === 'P0' || obj.priority === 'P1' || obj.priority === 'P2' || obj.priority === 'P3'
        ? obj.priority
        : null;
    const type = obj.type === 'news' || obj.type === 'product' ? obj.type : null;
    const channels = Array.isArray(obj.channels)
      ? obj.channels.filter((c): c is string => typeof c === 'string')
      : null;
    const v = typeof obj.v === 'number' && Number.isFinite(obj.v) ? obj.v : null;

    if (!titleClean && !summary && score === null) continue;
    cache.set(url, {
      title_clean: titleClean,
      summary,
      score,
      priority,
      type,
      channels: channels && channels.length ? channels : null,
      v,
    });
  }

  return cache;
}

/**
 * 缓存序列化为可写入 JSON 的 POJO。
 */
export function summaryCacheToPojo(
  cache: Map<string, SummaryEntry>
): Record<string, SummaryEntry> {
  const obj: Record<string, SummaryEntry> = {};
  for (const [url, entry] of cache) {
    obj[url] = entry;
  }
  return obj;
}
