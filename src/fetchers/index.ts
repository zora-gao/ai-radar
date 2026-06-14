export { BaseFetcher, runFetcher } from './base.js';
export { TechUrlsFetcher } from './techurls.js';
export { BuzzingFetcher } from './buzzing.js';
export { IrisFetcher } from './iris.js';
export { BestBlogsFetcher } from './bestblogs.js';
export { TophubFetcher } from './tophub.js';
export { ZeliFetcher } from './zeli.js';
export { AiHubTodayFetcher } from './aihubtoday.js';
export { AiBaseFetcher } from './aibase.js';
export { AiHotFetcher } from './aihot.js';
export { NewsNowFetcher } from './newsnow.js';
export { YouTubeFetcher } from './youtube.js';
export { XinzhiyuanFetcher } from './xinzhiyuan.js';
export { WechatRssFetcher } from './wechat-rss.js';
export { fetchOpmlRss } from './opml-rss.js';
export { fetchWaytoagiRecent7d } from './waytoagi.js';
export {
  createCuratedFetchers,
  CURATED_SOURCES,
  CURATED_SITE_IDS,
} from './curated.js';

import type { Fetcher } from '../types.js';
import { createCuratedFetchers } from './curated.js';

/**
 * 系统唯一的信源入口：只返回 AI Radar 精选信源（见 curated.ts）。
 * 已移除全部聚合型/热榜型数据源，确保收录范围严格等于用户指定的信源清单。
 */
export function createAllFetchers(): Fetcher[] {
  return createCuratedFetchers();
}
