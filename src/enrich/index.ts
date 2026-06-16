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
 * v3：摘要升级为 2~3 句、60~120 字、说清主要内容）。
 */
const ENRICH_VERSION = 3;

/** 缓存条目是否已包含 AI Radar 评分（用于判断旧缓存是否需要补评） */
function hasRadarScore(entry: SummaryEntry | undefined): boolean {
  return !!entry && typeof entry.score === 'number' && Number.isFinite(entry.score);
}

/** 缓存条目是否为当前版本（旧版本需重生成以应用新逻辑） */
function isCurrentVersion(entry: SummaryEntry | undefined): boolean {
  return !!entry && typeof entry.v === 'number' && entry.v >= ENRICH_VERSION;
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
  // 命中条件：缓存缺失，或旧缓存仅有摘要但缺 radar 评分，或旧缓存为过期版本（需用新逻辑重生成）
  const candidates: Array<{ url: string; title: string; description: string }> = [];
  const seen = new Set<string>();

  for (const it of itemsAi) {
    const url = normalizeUrl(it.url || '');
    if (!url || seen.has(url)) continue;

    const cached = cache.get(url);
    if (cached && hasRadarScore(cached) && isCurrentVersion(cached)) continue;

    // 改写标题需要原始英文标题与描述作上下文，避免把光秃秃的产品名直译
    const title = (it.title || it.title_en || it.title_zh || '').trim();
    if (!title) continue;

    seen.add(url);
    candidates.push({ url, title, description: (it.description || '').trim() });
  }

  let generated = 0;
  const todo = apiKey ? candidates.slice(0, Math.max(0, maxNew)) : [];

  if (todo.length > 0) {
    const limit = pLimit(concurrency);
    await Promise.all(
      todo.map((c) =>
        limit(async () => {
          const entry = await summarizeTitle(c.title, c.description, apiKey);
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
