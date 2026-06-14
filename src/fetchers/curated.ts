import Parser from 'rss-parser';
import type { RawItem, Fetcher } from '../types.js';
import { CONFIG } from '../config.js';
import { parseDate } from '../utils/date.js';

/**
 * AI Radar 精选信源注册表
 * ------------------------------------------------------------------
 * 这里是「唯一」的信源来源。系统只抓取本列表中的信源，不再使用任何
 * 聚合型/热榜型数据源，确保收录范围严格等于用户指定的信源清单。
 *
 * 如需增删信源：直接编辑下面的 CURATED_SOURCES 数组即可。
 * - id：稳定的站点标识（用于 source-status 与去重，勿随意改动）
 * - name：展示名称（与用户清单一致）
 * - category：news 行业动态 / product 新产品 / funding 融资 / official 官方
 * - feedUrl：可用的 RSS/Atom 地址
 * - verified：该 RSS 地址是否已确认可用（false 表示待人工核对真实地址）
 */

export type RadarCategory = 'news' | 'product' | 'funding' | 'official';

export interface CuratedSource {
  id: string;
  name: string;
  category: RadarCategory;
  feedUrl: string;
  /** 是否已确认 RSS 地址可用；false 表示地址为推测值，需人工核对 */
  verified: boolean;
  note?: string;
}

/**
 * 自建 WeWe RSS 服务地址（把微信公众号转成可抓取的 Atom feed）。
 * 本机调试默认 http://localhost:4000；部署到服务器时用环境变量
 * WEWE_RSS_BASE_URL 覆盖（如 https://rss.example.com）。
 * 注意：抓取这些公众号源时，该服务必须处于运行状态。
 */
const WEWE_RSS_BASE = (process.env.WEWE_RSS_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const weweFeed = (feedId: string): string => `${WEWE_RSS_BASE}/feeds/${feedId}.atom`;

export const CURATED_SOURCES: CuratedSource[] = [
  // ===== News —— 行业动态 =====
  {
    id: 'jiqizhixin',
    name: '机器之心',
    category: 'news',
    feedUrl: 'https://decemberpei.cyou/rssbox/wechat-jiqizhixin.xml',
    verified: true,
  },
  {
    id: 'ai-news',
    name: 'AI News',
    category: 'news',
    feedUrl: 'https://www.artificialintelligence-news.com/feed/',
    verified: true,
    note: 'artificialintelligence-news.com 官方 RSS（WordPress feed）',
  },
  {
    id: 'guixingren',
    name: '硅星人Pro',
    category: 'news',
    feedUrl: weweFeed('MP_WXS_3926568365'),
    verified: true,
    note: '经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'guancha-insights',
    name: '观猹insights',
    category: 'news',
    feedUrl: weweFeed('MP_WXS_3191673346'),
    verified: true,
    note: '经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    category: 'news',
    feedUrl: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    verified: true,
  },
  {
    id: 'theinformation',
    name: 'The Information',
    category: 'news',
    feedUrl: 'https://www.theinformation.com/feed',
    verified: true,
    note: '已实测可用（约 20 条）；付费墙站点，正文多为摘要',
  },
  {
    id: 'bloomberg-tech',
    name: 'Bloomberg Tech',
    category: 'news',
    feedUrl: 'https://feeds.bloomberg.com/technology/news.rss',
    verified: false,
    note: 'Bloomberg 反爬较强，RSS 可能不稳定，需核对',
  },

  // ===== Product —— 新产品发布 =====
  {
    id: 'producthunt',
    name: 'Product Hunt',
    category: 'product',
    feedUrl: 'https://www.producthunt.com/feed',
    verified: true,
    note: '已实测可用（Atom，约 50 条）',
  },
  {
    id: 'theresanaiforthat',
    name: "There's An AI For That",
    category: 'product',
    feedUrl: 'https://theresanaiforthat.com/feed/',
    verified: false,
    note: 'Cloudflare 拦截（403），无公开可用 RSS',
  },
  {
    id: 'ycombinator',
    name: 'YC Companies',
    category: 'product',
    feedUrl: 'https://www.ycombinator.com/blog/rss.xml',
    verified: true,
    note: 'YC 无公司列表 RSS，使用官方博客 RSS 作为近似替代（已实测可用）',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Trending',
    category: 'product',
    feedUrl: 'https://huggingface.co/blog/feed.xml',
    verified: true,
    note: 'HF Trending 无 RSS，使用官方 Blog feed 作为近似来源',
  },

  // ===== Funding —— 融资动态 =====
  {
    id: 'crunchbase',
    name: 'Crunchbase',
    category: 'funding',
    feedUrl: 'https://news.crunchbase.com/feed/',
    verified: true,
    note: '使用 Crunchbase News 官方 RSS（已实测可用，约 10 条）',
  },
  {
    id: 'cbinsights',
    name: 'CB Insights',
    category: 'funding',
    feedUrl: 'https://www.cbinsights.com/research/feed/',
    verified: false,
    note: 'Cloudflare 拦截（403），无公开可用 RSS',
  },

  // ===== 官方信源 —— 大公司动态 =====
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'official',
    feedUrl: 'https://openai.com/news/rss.xml',
    verified: true,
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    category: 'official',
    feedUrl: 'https://blog.google/innovation-and-ai/technology/ai/rss/',
    verified: true,
    note: '已实测可用（旧地址 /technology/ai/rss/ 会 301 跳转至此）',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'official',
    feedUrl: 'https://www.anthropic.com/rss.xml',
    verified: false,
    note: 'Anthropic 官网未提供公开 RSS（候选地址均 404），需第三方代理生成',
  },
  {
    id: 'meta-ai',
    name: 'Meta',
    category: 'official',
    feedUrl: 'https://about.fb.com/news/feed/',
    verified: true,
  },
  {
    id: 'microsoft-ai',
    name: 'Microsoft AI',
    category: 'official',
    feedUrl: 'https://news.microsoft.com/source/topics/ai/feed/',
    verified: false,
    note: '原 blogs.microsoft.com/ai/feed/ 已废弃（410），改用 news.microsoft.com AI 主题 feed，待实测确认',
  },
  {
    id: 'apple-ml',
    name: 'Apple Intelligence',
    category: 'official',
    feedUrl: 'https://machinelearning.apple.com/rss.xml',
    verified: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    category: 'official',
    feedUrl: 'https://www.perplexity.ai/hub/rss.xml',
    verified: false,
    note: 'Cloudflare 拦截（403），无公开可用 RSS',
  },
  {
    id: 'qianwen',
    name: '千问大模型',
    category: 'official',
    feedUrl: weweFeed('MP_WXS_3948884294'),
    verified: true,
    note: '阿里通义千问官方公众号，经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'moonshot',
    name: '月之暗面 Kimi',
    category: 'official',
    feedUrl: weweFeed('MP_WXS_3944550926'),
    verified: true,
    note: '经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'doubao',
    name: '豆包',
    category: 'official',
    feedUrl: weweFeed('MP_WXS_3931663331'),
    verified: true,
    note: '字节豆包官方公众号，经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'baidu',
    name: '百度',
    category: 'official',
    feedUrl: weweFeed('MP_WXS_2397569822'),
    verified: true,
    note: '经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'aliyun',
    name: '阿里云',
    category: 'official',
    feedUrl: weweFeed('MP_WXS_3086283381'),
    verified: true,
    note: '经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'alibaba',
    name: '阿里巴巴',
    category: 'official',
    feedUrl: weweFeed('MP_WXS_2394901817'),
    verified: true,
    note: '经自建 WeWe RSS 服务转换（需本地 :4000 服务运行）',
  },
  {
    id: 'tencent',
    name: '腾讯',
    category: 'official',
    // TODO: 需先在 WeWe RSS 后台订阅「腾讯」公众号，拿到 feedId 后替换占位值
    feedUrl: weweFeed('MP_WXS_TENCENT_TODO'),
    verified: false,
    note: '待办：WeWe RSS 尚未订阅腾讯公众号，订阅后将 MP_WXS_TENCENT_TODO 替换为真实 feedId 即可生效',
  },
];

/** 所有精选信源的 site_id 集合，供主流程跳过关键词粗筛（精选源全部交给 Radar 打分） */
export const CURATED_SITE_IDS = new Set<string>(CURATED_SOURCES.map((s) => s.id));

/**
 * 单个精选信源的 RSS 抓取器。每个信源一个实例，便于在 source-status 中独立展示。
 * 单源失败不影响其他源（内部 try/catch），只会在状态面板标记为失败。
 */
class CuratedRssFetcher implements Fetcher {
  siteId: string;
  siteName: string;
  private feedUrl: string;
  private category: RadarCategory;

  constructor(source: CuratedSource) {
    this.siteId = source.id;
    this.siteName = source.name;
    this.feedUrl = source.feedUrl;
    this.category = source.category;
  }

  async fetch(now: Date): Promise<RawItem[]> {
    const parser = new Parser({
      timeout: CONFIG.rss.feedTimeout,
      headers: {
        'User-Agent': CONFIG.http.userAgent,
        Accept:
          'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    const parsed = await parser.parseURL(this.feedUrl);
    const items: RawItem[] = [];

    for (const entry of parsed.items || []) {
      const title = (entry.title || '').trim();
      const url = (entry.link || '').trim();
      if (!title || !url) continue;

      // 优先用条目自身时间；缺失时回退到 now，避免精选信源内容被时间窗口丢弃
      const publishedAt =
        parseDate(entry.isoDate, now) || parseDate(entry.pubDate, now) || now;

      items.push({
        siteId: this.siteId,
        siteName: this.siteName,
        source: this.siteName,
        title,
        url,
        publishedAt,
        meta: {
          category: this.category,
          feed_url: this.feedUrl,
          description: (entry.contentSnippet || entry.content || '').slice(0, 200),
        },
      });
    }

    return items;
  }
}

/** 基于注册表构建所有精选信源抓取器 */
export function createCuratedFetchers(): Fetcher[] {
  return CURATED_SOURCES.map((s) => new CuratedRssFetcher(s));
}
