export interface NewsItem {
  id: string
  site_id: string
  site_name: string
  source: string
  title: string
  url: string
  published_at: string | null
  first_seen_at: string
  last_seen_at: string
  title_original: string
  title_en: string | null
  title_zh: string | null
  title_bilingual: string
  title_clean?: string | null
  summary?: string | null
  // 条目在来源 feed 中的原始排序位（1 起）。Product Hunt 等榜单源用于还原平台排名，越小越靠前
  feed_rank?: number | null
  // AI Radar 准入评审字段
  radar_score?: number | null
  radar_priority?: 'P0' | 'P1' | 'P2' | 'P3' | null
  radar_type?: 'news' | 'product' | null
  radar_channels?: string[] | null
}

export interface SiteStat {
  site_id: string
  site_name: string
  count: number
  raw_count: number
}

export interface NewsData {
  generated_at: string
  window_hours: number
  total_items: number
  total_items_ai_raw: number
  total_items_raw: number
  total_items_all_mode: number
  topic_filter: string
  archive_total: number
  site_count: number
  source_count: number
  site_stats: SiteStat[]
  items: NewsItem[]
}

export interface SourceStatus {
  generated_at: string
  sites: SiteStatus[]
  successful_sites: number
  failed_sites: string[]
  zero_item_sites: string[]
  fetched_raw_items: number
  items_before_topic_filter: number
  items_in_24h: number
}

export interface SiteStatus {
  site_id: string
  site_name: string
  ok: boolean
  item_count: number
  duration_ms: number
  error: string | null
}
