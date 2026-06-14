import { useState, useEffect, useCallback } from 'react'
import type { ModelsData } from '../types/models'

interface UseModelsDataReturn {
  data: ModelsData | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useModelsData(enabled: boolean): UseModelsDataReturn {
  const [data, setData] = useState<ModelsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/models.json`, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error('模型数据加载失败（请先运行 npm run fetch:models 生成 data/models.json）')
      }
      const json: ModelsData = await response.json()
      setData(json)
      setHasLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }, [])

  // 仅在 Models 视图首次激活时才加载，避免无谓请求
  useEffect(() => {
    if (enabled && !hasLoaded && !loading) {
      fetchData()
    }
  }, [enabled, hasLoaded, loading, fetchData])

  return { data, loading, error, refresh: fetchData }
}
