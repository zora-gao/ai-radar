import { Package } from 'lucide-react'
import type { NewsItem } from '../types'
import type { VisitedLinkInfo } from '../hooks/useVisitedLinks'
import type { TimeRange } from '../hooks/useNewsData'
import { NewsList } from './NewsList'

interface ProductsPageProps {
  items: NewsItem[]
  loading: boolean
  error: string | null
  timeRange: TimeRange
  visitedLinks: Record<string, VisitedLinkInfo>
  onVisit: (url: string, title?: string) => void
  isFavorite?: (url: string) => boolean
  onToggleFavorite?: (url: string, title: string) => void
}

/**
 * 「产品」tab：独立展示 Product Hunt 信源。
 * 列表已在数据层按「发布日期倒序 + Product Hunt 榜单位次升序」排好，
 * 体现 Product Hunt 平台排名，而非按 AI Radar 打分排序。
 */
export function ProductsPage({
  items,
  loading,
  error,
  timeRange,
  visitedLinks,
  onVisit,
  isFavorite,
  onToggleFavorite,
}: ProductsPageProps) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="card p-4 sm:p-5 flex items-start gap-3 animate-fade-in">
        <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex-shrink-0">
          <Package className="w-5 h-5 text-orange-500" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Product Hunt 热门产品
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            按 Product Hunt 平台排名展示（{timeRange === '24h' ? '近 24 小时' : '近 7 天'}），按上榜位次排序
          </p>
        </div>
      </div>

      <NewsList
        items={items}
        loading={loading}
        error={error}
        hasMore={false}
        onLoadMore={() => {}}
        visitedLinks={visitedLinks}
        onVisit={onVisit}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
    </main>
  )
}
