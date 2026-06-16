import { ExternalLink, Clock, BadgeCheck, Star } from 'lucide-react'
import type { NewsItem } from '../types'
import { SourceBadge } from './SourceBadge'
import { formatDateTime } from '../utils/formatDate'
import { Analytics } from '../utils/analytics'
import { cleanTitle } from '../utils/cleanTitle'
import { extractKeywords } from '../utils/keywords'

interface NewsCardProps {
  item: NewsItem
  index: number
  isVisited?: boolean
  isFavorite?: boolean
  onVisit?: (url: string, title?: string) => void
  onToggleFavorite?: (url: string, title: string) => void
}

export function NewsCard({ item, index, isVisited = false, isFavorite = false, onVisit, onToggleFavorite }: NewsCardProps) {
  const rawTitle = item.title_zh || item.title_en || item.title_bilingual || item.title
  // 优先使用 LLM 生成的精炼标题；无则回退到本地规则清洗
  const displayTitle = (item.title_clean && item.title_clean.trim()) || cleanTitle(rawTitle)
  const summary = item.summary?.trim() || ''
  const keywords = extractKeywords(displayTitle)

  // AI Radar 准入信息
  const priority = item.radar_priority || null
  const channels = item.radar_channels || []
  const score = typeof item.radar_score === 'number' && Number.isFinite(item.radar_score)
    ? item.radar_score
    : null
  const PRIORITY_STYLE: Record<string, string> = {
    P0: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800',
    P1: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800',
    P2: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    P3: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  }

  const handleClick = () => {
    Analytics.trackNewsClick(displayTitle, item.source, item.site_id)
    onVisit?.(item.url, displayTitle)
  }

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    Analytics.trackNewsFavorite(displayTitle, isFavorite ? 'remove' : 'add')
    onToggleFavorite?.(item.url, displayTitle)
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`card card-hover p-4 block animate-slide-up group relative transition-all duration-300 ${
        isVisited ? 'visited-card' : ''
      }`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {priority && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold flex-shrink-0 ${PRIORITY_STYLE[priority]}`}
              >
                {priority}
              </span>
            )}
            <SourceBadge siteId={item.site_id} siteName={item.site_name} />
            <span className={`text-xs truncate max-w-[200px] ${
              isVisited 
                ? 'text-slate-400 dark:text-slate-500' 
                : 'text-slate-500 dark:text-slate-400'
            }`}>
              {item.source}
            </span>
            {isVisited && (
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <BadgeCheck className="w-3.5 h-3.5" />
                <span className="text-[12px] font-medium">已读</span>
              </span>
            )}
            {score !== null && (
              <span
                className={`ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold flex-shrink-0 tabular-nums ${
                  score >= 85
                    ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
                    : score >= 70
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title="AI Radar 价值评分"
              >
                <Star className="w-3 h-3 fill-current" />
                {score}
              </span>
            )}
          </div>
          
          <h3 className={`text-base font-medium leading-relaxed transition-colors line-clamp-2 ${
            isVisited
              ? 'text-slate-400 dark:text-slate-500 group-hover:text-primary-500 dark:group-hover:text-primary-400'
              : 'text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400'
          }`}>
            {displayTitle}
          </h3>

          {summary && (
            <p className={`text-sm leading-relaxed mt-2 ${
              isVisited
                ? 'text-slate-400 dark:text-slate-500'
                : 'text-slate-600 dark:text-slate-300'
            }`}>
              {summary}
            </p>
          )}

          {(channels.length > 0 || keywords.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {channels.map((ch) => (
                <span
                  key={`ch-${ch}`}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                    isVisited
                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                      : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300'
                  }`}
                >
                  {ch}
                </span>
              ))}
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                    isVisited
                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                      : 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300'
                  }`}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          <div className={`flex items-center justify-between gap-4 mt-3 text-xs ${
            isVisited 
              ? 'text-slate-400 dark:text-slate-500' 
              : 'text-slate-500 dark:text-slate-400'
          }`}>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDateTime(item.published_at || item.first_seen_at)}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary-600 dark:text-primary-400 group-hover:underline flex-shrink-0">
              阅读原文
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <button
            onClick={handleToggleFavorite}
            className={`p-1.5 rounded-lg transition-all ${
              isFavorite
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            }`}
            title={isFavorite ? '取消收藏' : '收藏'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </a>
  )
}
