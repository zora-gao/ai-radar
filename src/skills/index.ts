/**
 * GitHub Skills 抓取器
 *
 * 实时调用 GitHub Search API，抓取 AI Agent 技能、MCP 工具、热门插件类仓库，
 * 计算近 7 天 star 增量（基于本地历史快照），抓取 README 摘录，并复用项目内
 * 既有的中文翻译能力（translateToZhCN）把描述/README 摘录翻成中文，
 * 最终产出 data/skills.json 供前端 Skills 二级页消费。
 *
 * 运行：npm run fetch:skills
 * 可选环境变量：GITHUB_TOKEN（提高 API 速率上限）
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';

import { CONFIG } from '../config.js';
import { fetchJson } from '../utils/http.js';
import { translateToZhCN } from '../translate/index.js';
import { writeJson } from '../output/index.js';
import { utcNow, toISOString, parseISO } from '../utils/date.js';

const GITHUB_API = 'https://api.github.com';

/** GitHub Search API 返回的仓库结构（只取用到的字段） */
interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  language: string | null;
  topics?: string[];
  owner: { login: string };
  pushed_at: string;
  updated_at: string;
  fork: boolean;
  archived: boolean;
}

interface GhSearchResp {
  total_count: number;
  items: GhRepo[];
}

/** 输出到 skills.json 的单条技能仓库 */
interface SkillItem {
  id: string;
  name: string;
  display_name: string;
  owner: string;
  full_name: string;
  html_url: string;
  homepage: string | null;
  stars: number;
  stars_7d: number | null;
  language: string | null;
  topics: string[];
  description: string | null;
  description_zh: string | null;
  readme_excerpt: string | null;
  readme_excerpt_zh: string | null;
  pushed_at: string | null;
  updated_at: string | null;
}

interface StarSnapshot {
  ts: string;
  stars: number;
}

/**
 * 多组检索词：聚焦「AI Agent 技能 / MCP 工具 / 热门插件」。
 * 每组取若干高 star 仓库，最后合并去重。
 */
const SEARCH_QUERIES: string[] = [
  'claude skills in:name,description',
  'awesome claude in:name,description',
  'mcp server in:name,description',
  'mcp servers in:name,description',
  'awesome mcp in:name,description',
  'ai agent skills in:name,description',
  'awesome ai agents in:name,description',
  'topic:mcp',
  'topic:claude',
  'topic:ai-agent',
  'topic:llm-agent',
];

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': CONFIG.http.userAgent,
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchRepos(query: string, perPage: number): Promise<GhRepo[]> {
  const params = new URLSearchParams({
    q: query,
    sort: 'stars',
    order: 'desc',
    per_page: String(perPage),
  });
  try {
    const resp = await fetchJson<GhSearchResp>(`${GITHUB_API}/search/repositories?${params}`, {
      headers: ghHeaders(),
      timeout: 20000,
      retries: 2,
    });
    return resp.items || [];
  } catch (e) {
    console.warn(`  ⚠️  query failed: ${query} -> ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

/** 把 awesome-claude-skills 这种仓库名转成更友好的展示名 */
function toDisplayName(name: string): string {
  return name
    .replace(/[-_.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim();
}

/** 抓取 README 并清洗成纯文本摘录 */
async function fetchReadmeExcerpt(fullName: string, maxLen = 360): Promise<string | null> {
  try {
    const resp = await fetchJson<{ content?: string; encoding?: string }>(
      `${GITHUB_API}/repos/${fullName}/readme`,
      { headers: ghHeaders(), timeout: 20000, retries: 1 }
    );
    if (!resp?.content) return null;
    const raw = Buffer.from(resp.content, (resp.encoding as BufferEncoding) || 'base64').toString('utf-8');
    const cleaned = raw
      .replace(/```[\s\S]*?```/g, ' ') // 代码块
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
      .replace(/<[^>]+>/g, ' ') // HTML 标签（含 badge）
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 链接保留文字
      .replace(/^#{1,6}\s*/gm, '') // 标题井号
      .replace(/[>*_`~|]/g, ' ') // markdown 符号
      .replace(/!\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return null;
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() + '…' : cleaned;
  } catch {
    return null;
  }
}

async function loadHistory(path: string): Promise<Record<string, StarSnapshot[]>> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as Record<string, StarSnapshot[]>;
  } catch {
    return {};
  }
}

async function loadZhCache(path: string): Promise<Record<string, string>> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * 计算近 7 天 star 增量：
 * 在历史快照里找「距今 ≥ ~6.5 天」中最接近 7 天边界的一条，用当前 star 减去它。
 * 没有足够老的快照时返回 null（前端不展示增量标签）。
 */
function computeStars7d(history: StarSnapshot[], currentStars: number, now: Date): number | null {
  if (!history || history.length === 0) return null;
  const sevenDayAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const minOld = now.getTime() - 6.5 * 24 * 60 * 60 * 1000;

  let best: StarSnapshot | null = null;
  for (const snap of history) {
    const ts = parseISO(snap.ts)?.getTime();
    if (ts == null) continue;
    if (ts <= minOld) {
      // 选最接近 7 天前的那条（即时间戳最大的、但仍 ≥6.5 天的）
      if (!best || Math.abs(ts - sevenDayAgo) < Math.abs((parseISO(best.ts)?.getTime() ?? 0) - sevenDayAgo)) {
        best = snap;
      }
    }
  }
  if (!best) return null;
  const delta = currentStars - best.stars;
  return delta > 0 ? delta : null;
}

async function main(): Promise<number> {
  const program = new Command();
  program
    .name('fetch-skills')
    .description('Fetch trending AI skill/MCP repos from GitHub, translate, output skills.json')
    .option('--output-dir <dir>', 'Directory for output JSON files', 'data')
    .option('--top <count>', 'Max number of skills to keep', '15')
    .option('--per-query <count>', 'Repos fetched per search query', '12')
    .option('--translate-max <count>', 'Max new translations (desc+readme) per run', '60')
    .parse();

  const opts = program.opts();
  const outputDir = resolve(opts.outputDir);
  const top = parseInt(opts.top);
  const perQuery = parseInt(opts.perQuery);
  const translateMax = parseInt(opts.translateMax);

  const now = utcNow();
  const skillsPath = join(outputDir, 'skills.json');
  const historyPath = join(outputDir, 'skills-stars-history.json');
  const zhCachePath = join(outputDir, 'skills-zh-cache.json');

  console.log('📡 Searching GitHub for AI skill / MCP / agent repos...');
  if (!process.env.GITHUB_TOKEN?.trim()) {
    console.log('ℹ️  GITHUB_TOKEN 未设置，使用匿名速率（建议设置以避免限流）');
  }

  // 1) 多组检索 + 合并去重
  const byFullName = new Map<string, GhRepo>();
  for (const q of SEARCH_QUERIES) {
    const repos = await searchRepos(q, perQuery);
    for (const r of repos) {
      if (!r || r.fork || r.archived) continue;
      if (!byFullName.has(r.full_name)) byFullName.set(r.full_name, r);
    }
    await sleep(1200); // search API 限流：约 10 次/分钟
  }

  const merged = Array.from(byFullName.values())
    .filter((r) => r.stargazers_count >= 50)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, top);

  console.log(`📊 Merged ${byFullName.size} unique repos, keeping top ${merged.length}`);

  // 2) 历史快照 + 翻译缓存
  const history = await loadHistory(historyPath);
  const zhCache = await loadZhCache(zhCachePath);
  let translatedNow = 0;

  const translateCached = async (text: string | null): Promise<string | null> => {
    const s = (text || '').trim();
    if (!s) return null;
    if (zhCache[s]) return zhCache[s];
    if (translatedNow >= translateMax) return null;
    const tr = await translateToZhCN(s);
    if (tr) {
      zhCache[s] = tr;
      translatedNow++;
      return tr;
    }
    return null;
  };

  // 3) 逐仓库：算增量、抓 README、翻译
  const items: SkillItem[] = [];
  for (const r of merged) {
    const fullName = r.full_name;
    const stars7d = computeStars7d(history[fullName] || [], r.stargazers_count, now);

    const readme = await fetchReadmeExcerpt(fullName);
    const descZh = await translateCached(r.description);
    const readmeZh = await translateCached(readme);

    items.push({
      id: fullName,
      name: r.name,
      display_name: toDisplayName(r.name),
      owner: r.owner?.login || fullName.split('/')[0],
      full_name: fullName,
      html_url: r.html_url,
      homepage: r.homepage || null,
      stars: r.stargazers_count,
      stars_7d: stars7d,
      language: r.language,
      topics: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [],
      description: r.description,
      description_zh: descZh,
      readme_excerpt: readme,
      readme_excerpt_zh: readmeZh,
      pushed_at: toISOString(parseISO(r.pushed_at) || null),
      updated_at: toISOString(parseISO(r.updated_at) || null),
    });

    // 更新历史快照（每仓库最多保留 30 条）
    const snaps = history[fullName] || [];
    snaps.push({ ts: toISOString(now)!, stars: r.stargazers_count });
    history[fullName] = snaps.slice(-30);

    await sleep(250);
  }

  // 4) 按 7d 增量优先、其次 star 排序（与截图「按近7日增量排序」一致）
  items.sort((a, b) => {
    const ga = a.stars_7d ?? -1;
    const gb = b.stars_7d ?? -1;
    if (gb !== ga) return gb - ga;
    return b.stars - a.stars;
  });

  const payload = {
    generated_at: toISOString(now)!,
    count: items.length,
    items,
  };

  console.log('💾 Writing output...');
  await writeJson(skillsPath, payload);
  await writeJson(historyPath, history);
  await writeJson(zhCachePath, zhCache);

  console.log(`  ✅ ${skillsPath} (${items.length} skills)`);
  console.log(`  ✅ ${historyPath}`);
  console.log(`  ✅ ${zhCachePath} (${Object.keys(zhCache).length} entries, ${translatedNow} new)`);
  console.log('🎉 Done!');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
