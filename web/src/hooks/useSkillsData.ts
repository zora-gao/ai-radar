import { useState, useEffect, useCallback } from 'react'
import type { SkillsData } from '../types/skills'

interface UseSkillsDataReturn {
  data: SkillsData | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useSkillsData(enabled: boolean): UseSkillsDataReturn {
  const [data, setData] = useState<SkillsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}data/skills.json`, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error('Skills 数据加载失败（请先运行 npm run fetch:skills 生成 data/skills.json）')
      }
      const json: SkillsData = await response.json()
      setData(json)
      setHasLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }, [])

  // 仅在 Skills 视图首次激活时才加载，避免首页无谓请求
  useEffect(() => {
    if (enabled && !hasLoaded && !loading) {
      fetchData()
    }
  }, [enabled, hasLoaded, loading, fetchData])

  return { data, loading, error, refresh: fetchData }
}
