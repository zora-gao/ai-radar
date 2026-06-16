import { postJson } from '../utils/http.js';

/**
 * 智谱 GLM 对话补全接口
 *
 * AI Radar 准入引擎（基于标题）：一次调用同时完成
 *  - 标题清洗 title_clean
 *  - 一句话摘要 summary
 *  - 准入评审：score / priority / type / channels
 *
 * 鉴权使用环境变量 GLM_API_KEY（env-only，禁止硬编码）。
 * 模型可用 GLM_MODEL 覆盖，默认使用免费的 Flash 系列。
 */
const GLM_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DEFAULT_MODEL = 'glm-4.5-flash';

export type RadarPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type RadarType = 'news' | 'product';

/** AI Radar 频道（方向标签）枚举，prompt 与前端共用 */
export const RADAR_CHANNELS = [
  'AI助手',
  'AI Agent',
  '多模态',
  'AI搜索',
  '服务场景',
  '竞品动态',
  '商业化',
  '用户需求',
] as const;
export type RadarChannel = (typeof RADAR_CHANNELS)[number];

export interface SummaryEntry {
  title_clean: string;
  summary: string;
  /** 0-100 综合准入分；缺失表示尚未评审 */
  score?: number | null;
  priority?: RadarPriority | null;
  /** 行业动态 news / 新产品 product */
  type?: RadarType | null;
  /** 方向标签 */
  channels?: string[] | null;
  /** 生成此条目所用的 enrich 逻辑版本（用于旧缓存逐步重生成） */
  v?: number | null;
}

interface GlmChoice {
  message?: { content?: string | null };
}

interface GlmResponse {
  choices?: GlmChoice[];
  error?: { code?: string; message?: string };
}

const SYSTEM_PROMPT = [
  '你是「元宝 AI Radar」的资深内容准入编辑。元宝是一款 AI 助手类产品，读者是元宝的产品经理。',
  '我会给你一条资讯的【原始标题】，可能还附带一段【描述】（来自 RSS 摘要/产品介绍）。请综合标题与描述判断它对元宝产品经理的参考价值，并只返回一个 JSON 对象。',
  '',
  '【重要：标题改写规则】很多来源（尤其 Product Hunt 等产品发布站）的原始标题只是一个产品名（如 "Momentra"、"Cloudback for Linear"、"Taste Lab"），单看标题完全不知道它是做什么的。这时必须借助【描述】把标题改写成「能看懂这是什么」的中文标题：',
  '  - 概括产品/事件的核心功能或价值，而不是逐字直译产品名（绝不要把 "Momentum" 译成「动量」、"Linear" 译成「线性」这类无意义直译）。',
  '  - 【产品类必须遵守】当 type 为 product 时，title_clean 必须严格采用「英文产品名：中文功能简述」格式，中间用中文全角冒号「：」分隔。例如 "Taste Lab" + 描述(AI 美食推荐) → "Taste Lab：AI 美食口味推荐工具"。功能简述要短（不超过 20 字），点明它是做什么的。',
  '  - 【严禁音译】绝不要把英文产品名音译成无意义的中文（如把 "Obotic" 写成「奥博蒂克」、"Picone" 写成「皮卡万」）。产品名一律保留英文原名，中文只用来描述功能。',
  '  - 若描述缺失、信息不足或仅是 "Discussion | Link" 之类无效内容，也必须保留英文原名并据产品名语义合理推断品类，输出形如「英文名：<推断的品类/用途>工具」的标题，绝不能只输出光秃的产品名或音译词。',
  '',
  '【准入目标】核心不是"AI 行业发生了什么"，而是"这条信息能否帮助判断产品方向、竞品变化、用户需求、服务场景和商业机会"。覆盖两类：行业动态(news) 与 新产品发布(product)。',
  '',
  '【优先收录方向】AI chatbot 产品更新；AI Agent 能力(工具调用/自动执行/跨应用操作/服务代办)；AI 服务场景(购物/外卖/办事/旅行/办公/客服)；多模态交互(语音/图像/视频/屏幕理解/实时摄像头/文件理解)；竞品动态(豆包/Kimi/通义/ChatGPT/Claude/Gemini/Perplexity 等)；用户需求变化；商业化与生态(广告/订阅/导购佣金/服务商接入/插件/MCP/API)。',
  '',
  '【不收录】泛AI概念、纯技术(模型参数/benchmark小幅提升/纯论文/纯训练方法，除非明确影响产品能力或成本)、纯融资(无业务信息)、空泛营销软文、重复转载、过旧资讯、纯AI绘画/生成且无新交互或场景、与chatbot/Agent/AI服务无关的工具。',
  '',
  '【评分维度，满分100】业务相关度35(是否与AI chatbot/Agent/服务/多模态/AI搜索直接相关)；产品启发价值25(能否启发功能/交互/场景/商业化)；竞品/生态重要性15；市场信号价值10(增长/流量/融资/合作/价格)；时效性5；可行动性10(能否转化为拆解/调研/合作评估/产品跟进)。',
  '【分数→优先级】85-100=P0(必收，重点)；70-84=P1(收录)；55-69=P2(普通信息流)；40-54=P3(待观察)；40以下=不收录。',
  '',
  '请输出以下字段，且只输出 JSON（不要解释、不要代码围栏）：',
  '{',
  '  "title_clean": "改写成精炼、客观、能看懂的中文标题：去掉夸张语气/表情/噱头；product 类必须用「英文产品名：中文功能简述」格式且禁止音译；保留核心事实与专有名词，不杜撰",',
  '  "summary": "必填，不得为空。结合标题与描述写成 2~3 句、约60~120 个汉字的客观摘要，说清这篇资讯/这个产品具体做了什么、关键事实与对产品经理的参考价值；行文连贯通顺，不堆砌、不夸张、不编造数字或结论，信息不足时就据产品名与品类合理归纳它的用途，绝不能留空",',
  '  "score": 0到100的整数,',
  '  "priority": "P0|P1|P2|P3",',
  '  "type": "news 或 product",',
  '  "channels": ["从以下选0-3个最贴切的方向标签：AI助手,AI Agent,多模态,AI搜索,服务场景,竞品动态,商业化,用户需求"]',
  '}',
].join('\n');

const VALID_PRIORITIES: RadarPriority[] = ['P0', 'P1', 'P2', 'P3'];
const VALID_CHANNELS = new Set<string>(RADAR_CHANNELS);

function clampScore(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseFloat(value)
        : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizePriority(value: unknown, score: number | null): RadarPriority | null {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if ((VALID_PRIORITIES as string[]).includes(v)) return v as RadarPriority;
  // 模型未给或非法时，按分数兜底推导
  if (score === null) return null;
  if (score >= 85) return 'P0';
  if (score >= 70) return 'P1';
  if (score >= 55) return 'P2';
  return 'P3';
}

function normalizeType(value: unknown): RadarType | null {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (v === 'news' || v === 'product') return v;
  return null;
}

function normalizeChannels(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const raw of value) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (s && VALID_CHANNELS.has(s) && !out.includes(s)) out.push(s);
    if (out.length >= 3) break;
  }
  return out.length ? out : null;
}

/**
 * 从模型返回文本中稳健地解析出 JSON 对象。
 */
function parseSummaryJson(content: string): SummaryEntry | null {
  const text = (content || '').trim();
  if (!text) return null;

  // 去掉可能的 ```json ... ``` 围栏，并截取首个 { 到最后一个 }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonSlice = text.slice(start, end + 1);

  try {
    const obj = JSON.parse(jsonSlice) as Record<string, unknown>;
    const titleClean = typeof obj.title_clean === 'string' ? obj.title_clean.trim() : '';
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    const score = clampScore(obj.score);
    const priority = normalizePriority(obj.priority, score);
    const type = normalizeType(obj.type);
    const channels = normalizeChannels(obj.channels);

    if (!titleClean && !summary && score === null) return null;

    return {
      title_clean: titleClean,
      summary,
      score,
      priority,
      type,
      channels,
    };
  } catch {
    return null;
  }
}

/**
 * 调用 GLM 为单条标题生成清洗标题、摘要与 AI Radar 准入评审。
 * 失败时返回 null（不抛出），由上层降级处理。
 */
export async function summarizeTitle(
  title: string,
  description: string,
  apiKey: string
): Promise<SummaryEntry | null> {
  const s = (title || '').trim();
  if (!s || !apiKey) return null;

  const model = process.env.GLM_MODEL?.trim() || DEFAULT_MODEL;

  const desc = (description || '').trim().slice(0, 300);
  const userContent = desc
    ? `【原始标题】${s}\n【描述】${desc}`
    : `【原始标题】${s}`;

  try {
    const res = await postJson<GlmResponse>(
      GLM_ENDPOINT,
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
        // GLM-4.5 系列为混合推理模型，默认开启思考(thinking)；思考内容会与正式输出
        // 共享 max_tokens 预算，常导致 JSON 被截断 → 解析失败返回 null。
        // 本任务是结构化标题改写/摘要，属"简单任务"，关闭思考可大幅提升成功率与速度。
        thinking: { type: 'disabled' },
      },
      {
        timeout: 30000,
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    const content = res?.choices?.[0]?.message?.content;
    if (!content) return null;

    return parseSummaryJson(content);
  } catch {
    return null;
  }
}
