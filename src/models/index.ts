/**
 * AI 模型对比数据抓取器
 *
 * 调用 OpenRouter 公开模型 API（https://openrouter.ai/api/v1/models，免 key），
 * 取「最新发布」的模型，整理厂商 / 上下文长度 / 输入输出价格 / 模态 / 发布时间等对比字段，
 * 并复用项目内既有的中文翻译能力（translateToZhCN）把模型描述翻成中文，
 * 最终产出 data/models.json 供前端「Models 模型对比」二级页消费。
 *
 * 运行：npm run fetch:models
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';

import { CONFIG } from '../config.js';
import { fetchJson } from '../utils/http.js';
import { translateToZhCN } from '../translate/index.js';
import { writeJson } from '../output/index.js';
import { utcNow, toISOString } from '../utils/date.js';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

/** OpenRouter 模型 API 返回结构（只取用到的字段） */
interface OrModel {
  id: string;
  canonical_slug?: string;
  hugging_face_id?: string | null;
  name: string;
  created: number;
  description: string | null;
  context_length: number | null;
  architecture?: {
    modality?: string | null;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string | null;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
    web_search?: string;
  };
  supported_parameters?: string[];
}

interface OrResp {
  data: OrModel[];
}

/** 输出到 models.json 的单条模型 */
interface ModelItem {
  id: string;
  name: string;
  vendor: string;
  vendor_slug: string;
  url: string;
  created_at: string | null;
  context_length: number | null;
  modality: string | null;
  input_modalities: string[];
  output_modalities: string[];
  /** 输入价格：美元 / 100 万 tokens；null 表示不可用/动态 */
  price_in: number | null;
  /** 输出价格：美元 / 100 万 tokens；null 表示不可用/动态 */
  price_out: number | null;
  is_free: boolean;
  supports_tools: boolean;
  supports_reasoning: boolean;
  description: string | null;
  description_zh: string | null;
}

/** 厂商 slug -> 友好展示名 */
const VENDOR_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'meta-llama': 'Meta',
  mistralai: 'Mistral AI',
  'x-ai': 'xAI',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  openrouter: 'OpenRouter',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
  microsoft: 'Microsoft',
  nvidia: 'NVIDIA',
  amazon: 'Amazon',
  ai21: 'AI21',
  nousresearch: 'Nous Research',
  moonshotai: 'Moonshot AI',
  'z-ai': 'Zhipu AI',
  baidu: 'Baidu',
  bytedance: 'ByteDance',
  tencent: 'Tencent',
  inflection: 'Inflection',
  liquid: 'Liquid',
  thudm: 'THUDM',
  minimax: 'MiniMax',
  '01-ai': '01.AI',
};

function vendorFromId(id: string): { slug: string; name: string } {
  const slug = (id.split('/')[0] || 'other').toLowerCase().replace(/^[~@]+/, '');
  const name =
    VENDOR_NAMES[slug] ||
    slug
      .replace(/[-_.]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  return { slug, name };
}

/** 把每 token 价格字符串转成「美元 / 100 万 tokens」，无效返回 null */
function pricePerMillion(raw?: string): number | null {
  if (raw == null) return null;
  const v = parseFloat(raw);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 1_000_000 * 1000) / 1000; // 保留 3 位小数
}

/** 清洗模型描述：去 markdown 链接/图片/HTML，截断后用于翻译与展示 */
function cleanDescription(raw: string | null, maxLen = 280): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`~#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() + '…' : cleaned;
}

async function loadZhCache(path: string): Promise<Record<string, string>> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<number> {
  const program = new Command();
  program
    .name('fetch-models')
    .description('Fetch latest AI models from OpenRouter, translate, output models.json')
    .option('--output-dir <dir>', 'Directory for output JSON files', 'data')
    .option('--top <count>', 'Max number of newest models to keep', '60')
    .option('--translate-max <count>', 'Max new translations per run', '60')
    .parse();

  const opts = program.opts();
  const outputDir = resolve(opts.outputDir);
  const top = parseInt(opts.top);
  const translateMax = parseInt(opts.translateMax);

  const now = utcNow();
  const modelsPath = join(outputDir, 'models.json');
  const zhCachePath = join(outputDir, 'models-zh-cache.json');

  console.log('📡 Fetching models from OpenRouter...');
  const resp = await fetchJson<OrResp>(OPENROUTER_API, {
    headers: {
      Accept: 'application/json',
      'User-Agent': CONFIG.http.userAgent,
    },
    timeout: 20000,
    retries: 2,
  });

  const all = Array.isArray(resp?.data) ? resp.data : [];
  console.log(`📊 Got ${all.length} models, keeping newest ${top}`);

  // 按发布时间倒序，取最新 N 个
  const newest = [...all]
    .filter((m) => m && m.id && m.name)
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, top);

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

  const items: ModelItem[] = [];
  for (const m of newest) {
    const { slug, name } = vendorFromId(m.id);
    const arch = m.architecture || {};
    const params = m.supported_parameters || [];
    const desc = cleanDescription(m.description);
    const descZh = await translateCached(desc);

    const priceIn = pricePerMillion(m.pricing?.prompt);
    const priceOut = pricePerMillion(m.pricing?.completion);

    items.push({
      id: m.id,
      name: m.name.replace(/^[^:]+:\s*/, '').trim() || m.name, // 去掉 "OpenAI: " 这类厂商前缀
      vendor: name,
      vendor_slug: slug,
      url: `https://openrouter.ai/${m.canonical_slug || m.id}`,
      created_at: m.created ? toISOString(new Date(m.created * 1000)) : null,
      context_length: m.context_length ?? null,
      modality: arch.modality ?? null,
      input_modalities: arch.input_modalities || [],
      output_modalities: arch.output_modalities || [],
      price_in: priceIn,
      price_out: priceOut,
      is_free: priceIn === 0 && priceOut === 0,
      supports_tools: params.includes('tools') || params.includes('tool_choice'),
      supports_reasoning: params.includes('reasoning') || params.includes('include_reasoning'),
      description: desc,
      description_zh: descZh,
    });

    if (translatedNow > 0 && translatedNow % 10 === 0) await sleep(200);
  }

  const payload = {
    generated_at: toISOString(now)!,
    source: 'OpenRouter',
    count: items.length,
    items,
  };

  console.log('💾 Writing output...');
  await writeJson(modelsPath, payload);
  await writeJson(zhCachePath, zhCache);

  console.log(`  ✅ ${modelsPath} (${items.length} models)`);
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
