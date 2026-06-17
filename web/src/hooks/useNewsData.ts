import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { NewsData, NewsItem, SiteStat } from '../types'

export interface SourceStat {
  source: string
  count: number
}

export type TimeRange = '24h' | '7d'

/** Product Hunt 已独立成「产品」tab，资讯流中需排除该来源 */
export const PRODUCT_HUNT_SITE_ID = 'producthunt'

interface UseNewsDataReturn {
  data: NewsData | null
  loading: boolean
  error: string | null
  filteredItems: NewsItem[]
  productItems: NewsItem[]
  newsTotal: number
  newsSourceCount: number
  siteStats: SiteStat[]
  sourceStats: SourceStat[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedSite: string
  setSelectedSite: (site: string) => void
  selectedSource: string
  setSelectedSource: (source: string) => void
  loadMore: () => void
  hasMore: boolean
  displayCount: number
  refresh: () => void
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void
  isSwitching: boolean
}

const PAGE_SIZE = 50

export function useNewsData(): UseNewsDataReturn {
  const [data, setData] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSite, setSelectedSite] = useState('all')
  const [selectedSource, setSelectedSource] = useState('all')
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [isSwitching, setIsSwitching] = useState(false)
  
  const preloadedDataRef = useRef<{ [key in TimeRange]?: NewsData }>({})
  const isInitialLoadRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (range: TimeRange, isPreload = false) => {
    if (preloadedDataRef.current[range] && !isPreload) {
      setData(preloadedDataRef.current[range]!)
      setLoading(false)
      setIsSwitching(false)
      return
    }

    if (!isPreload) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      
      if (isInitialLoadRef.current) {
        setLoading(true)
      } else {
        setIsSwitching(true)
      }
      setError(null)
    }

    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const fileName = range === '24h' ? 'latest-24h.json' : 'latest-7d.json'
      const signal = isPreload ? undefined : abortControllerRef.current?.signal
      
      const response = await fetch(`${basePath}data/${fileName}`, { signal })
      if (!response.ok) {
        throw new Error('数据加载失败')
      }
      const json = await response.json()
      
      preloadedDataRef.current[range] = json
      
      if (!isPreload) {
        setData(json)
        isInitialLoadRef.current = false
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      if (!isPreload) {
        setError(err instanceof Error ? err.message : '未知错误')
      }
    } finally {
      if (!isPreload) {
        setLoading(false)
        setIsSwitching(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchData(timeRange)
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [timeRange, fetchData])

  useEffect(() => {
    if (!isInitialLoadRef.current && !preloadedDataRef.current['7d']) {
      fetchData('7d', true)
    }
  }, [data, fetchData])

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range)
    setDisplayCount(PAGE_SIZE)
    setSelectedSite('all')
    setSelectedSource('all')
    setSearchQuery('')
  }, [])

  // 资讯流基础集合：剔除 Product Hunt（已独立为「产品」tab）
  const newsBaseItems = useMemo(
    () => (data?.items || []).filter(item => item.site_id !== PRODUCT_HUNT_SITE_ID),
    [data]
  )

  // 产品榜：仅 Product Hunt，按 Product Hunt 榜单位次（feed_rank）升序展示，
  // 完全还原平台榜单顺序，不按时间、也不按 AI Radar 打分排序。
  // feed_rank 缺失时回退到时间倒序，保证无榜单位次的条目排在后面。
  //
  // 注：Product Hunt 条目在后端 enrich 阶段享受「专属配额」，所有条目都会被
  // GLM 加工为「产品名：功能简述」格式 + 完整摘要；此处不做过滤，完整展示榜单。
  const productItems = useMemo(() => {
    const items = (data?.items || []).filter(item => item.site_id === PRODUCT_HUNT_SITE_ID)
    const rankOf = (it: NewsItem) =>
      typeof it.feed_rank === 'number' ? it.feed_rank : Number.MAX_SAFE_INTEGER
    const timeOf = (it: NewsItem) =>
      new Date(it.published_at || it.first_seen_at || 0).getTime()
    return items.slice().sort((a, b) => {
      const ra = rankOf(a)
      const rb = rankOf(b)
      if (ra !== rb) return ra - rb
      return timeOf(b) - timeOf(a)
    })
  }, [data])

  // 资讯口径统计（不含 Product Hunt）
  const newsTotal = newsBaseItems.length
  const newsSourceCount = useMemo(
    () => new Set(newsBaseItems.map(i => `${i.site_id}::${i.source}`)).size,
    [newsBaseItems]
  )
  const siteStats = useMemo(
    () => (data?.site_stats || []).filter(s => s.site_id !== PRODUCT_HUNT_SITE_ID),
    [data]
  )

  const sourceStats = useMemo(() => {
    if (selectedSite === 'all') return []
    
    const sourceMap = new Map<string, number>()
    newsBaseItems
      .filter(item => item.site_id === selectedSite)
      .forEach(item => {
        sourceMap.set(item.source, (sourceMap.get(item.source) || 0) + 1)
      })
    
    return Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
  }, [newsBaseItems, selectedSite])

  const filteredItems = useMemo(() => {
    let items = newsBaseItems
    
    if (selectedSite !== 'all') {
      items = items.filter(item => item.site_id === selectedSite)
    }

    if (selectedSource !== 'all') {
      items = items.filter(item => item.source === selectedSource)
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.source.toLowerCase().includes(query) ||
        (item.title_zh && item.title_zh.toLowerCase().includes(query))
      )
    }
    
    return items.slice(0, displayCount)
  }, [newsBaseItems, selectedSite, selectedSource, searchQuery, displayCount])

  const totalFiltered = useMemo(() => {
    let items = newsBaseItems
    
    if (selectedSite !== 'all') {
      items = items.filter(item => item.site_id === selectedSite)
    }

    if (selectedSource !== 'all') {
      items = items.filter(item => item.source === selectedSource)
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.source.toLowerCase().includes(query) ||
        (item.title_zh && item.title_zh.toLowerCase().includes(query))
      )
    }
    
    return items.length
  }, [newsBaseItems, selectedSite, selectedSource, searchQuery])

  const loadMore = () => {
    setDisplayCount(prev => prev + PAGE_SIZE)
  }

  const hasMore = displayCount < totalFiltered

  const refresh = () => {
    setDisplayCount(PAGE_SIZE)
    fetchData(timeRange)
  }

  useEffect(() => {
    setDisplayCount(PAGE_SIZE)
  }, [selectedSite, selectedSource, searchQuery])

  useEffect(() => {
    setSelectedSource('all')
  }, [selectedSite])

  return {
    data,
    loading,
    error,
    filteredItems,
    productItems,
    newsTotal,
    newsSourceCount,
    siteStats,
    sourceStats,
    searchQuery,
    setSearchQuery,
    selectedSite,
    setSelectedSite,
    selectedSource,
    setSelectedSource,
    loadMore,
    hasMore,
    displayCount,
    refresh,
    timeRange,
    setTimeRange: handleTimeRangeChange,
    isSwitching
  }
}
