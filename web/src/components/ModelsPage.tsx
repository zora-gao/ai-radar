import { useMemo, useState } from 'react'
import {
  Cpu,
  RefreshCw,
  Loader2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  AlertCircle,
  Search,
  Wrench,
  Brain,
  Eye,
} from 'lucide-react'
import type { ModelItem } from '../types/models'
import { useModelsData } from '../hooks/useModelsData'

interface ModelsPageProps {
  active: boolean
  onBackHome: () => void
}

type SortKey = 'created_at' | 'context_length' | 'price_in' | 'price_out' | 'name'
type SortDir = 'asc' | 'desc'

const VENDOR_COLOR: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
  'meta-llama': '#0668e1',
  mistralai: '#ff7000',
  'x-ai': '#111827',
  deepseek: '#4d6bfe',
  qwen: '#615ced',
  openrouter: '#6467f2',
}

function formatContext(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}

function formatPrice(p: number | null): string {
  if (p == null) return '—'
  if (p === 0) return '免费'
  if (p < 1) return `$${p.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`
  return `$${p.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const MODALITY_ZH: Record<string, string> = {
  text: '文本',
  image: '图像',
  audio: '音频',
  file: '文件',
  video: '视频',
}

function modalityLabel(m: ModelItem): string {
  const ins = (m.input_modalities.length ? m.input_modalities : ['text'])
    .map((x) => MODALITY_ZH[x] || x)
    .join('/')
  const outs = (m.output_modalities.length ? m.output_modalities : ['text'])
    .map((x) => MODALITY_ZH[x] || x)
    .join('/')
  return `${ins} → ${outs}`
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const activeCol = sortKey === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {activeCol ? (
          sortDir === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5 text-primary-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-primary-500" />
          )
        ) : (
          <ChevronDown className="w-3.5 h-3.5 opacity-0" />
        )}
      </span>
    </th>
  )
}

export function ModelsPage({ active, onBackHome }: ModelsPageProps) {
  const { data, loading, error, refresh } = useModelsData(active)
  const items = data?.items ?? []

  const [query, setQuery] = useState('')
  const [vendor, setVendor] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const vendors = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; count: number }>()
    for (const m of items) {
      const v = map.get(m.vendor_slug)
      if (v) v.count++
      else map.set(m.vendor_slug, { slug: m.vendor_slug, name: m.vendor, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items.filter((m) => {
      if (vendor !== 'all' && m.vendor_slug !== vendor) return false
      if (!q) return true
      return (
        m.name.toLowerCase().includes(q) ||
        m.vendor.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description_zh || m.description || '').toLowerCase().includes(q)
      )
    })

    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      let av: number | string | null
      let bv: number | string | null
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'created_at':
          av = a.created_at ? new Date(a.created_at).getTime() : 0
          bv = b.created_at ? new Date(b.created_at).getTime() : 0
          break
        case 'context_length':
          av = a.context_length ?? -1
          bv = b.context_length ?? -1
          break
        case 'price_in':
          av = a.price_in ?? Number.MAX_VALUE
          bv = b.price_in ?? Number.MAX_VALUE
          break
        case 'price_out':
          av = a.price_out ?? Number.MAX_VALUE
          bv = b.price_out ?? Number.MAX_VALUE
          break
      }
      return dir * ((av as number) - (bv as number))
    })
    return list
  }, [items, query, vendor, sortKey, sortDir])

  const onSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir(k === 'name' ? 'asc' : 'desc')
    }
  }

  const openModel = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* 标题区 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Models 模型对比
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            追踪全网最新发布的 AI 大模型，对比上下文长度、输入/输出价格、模态与能力。数据实时来自
            OpenRouter，描述已翻译为中文，点击任意一行可跳转模型详情页。
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-slate-400 dark:text-slate-500">{data?.count ?? 0} 个模型</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="btn btn-ghost border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            刷新
          </button>
        </div>
      </div>

      {/* 面包屑 */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-4">
        <button onClick={onBackHome} className="hover:text-primary-500 transition-colors">
          首页
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 dark:text-slate-300 font-medium">Models</span>
      </div>

      {error ? (
        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
          <button onClick={refresh} className="btn btn-primary text-sm">
            重试
          </button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">正在从 OpenRouter 加载最新模型…</p>
        </div>
      ) : (
        <section className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Cpu className="w-5 h-5 text-primary-500" />
              最新模型榜
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索模型 / 厂商 / 描述…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary-400 focus:bg-white dark:focus:bg-slate-900 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 厂商筛选 */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setVendor('all')}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                vendor === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              全部 {items.length}
            </button>
            {vendors.map((v) => (
              <button
                key={v.slug}
                onClick={() => setVendor(v.slug)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors inline-flex items-center gap-1.5 ${
                  vendor === v.slug
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: VENDOR_COLOR[v.slug] || '#94a3b8' }}
                />
                {v.name} {v.count}
              </button>
            ))}
          </div>

          {/* 表格 */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              {items.length === 0 ? (
                <>
                  暂无数据，请运行{' '}
                  <code className="px-1 bg-slate-100 dark:bg-slate-700 rounded">npm run fetch:models</code>{' '}
                  生成。
                </>
              ) : (
                '没有匹配的模型'
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs">
                    <SortHeader label="模型" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                    <SortHeader label="上下文" col="context_length" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                    <SortHeader label="输入价/1M" col="price_in" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                    <SortHeader label="输出价/1M" col="price_out" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                    <th className="px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap text-left">模态 / 能力</th>
                    <SortHeader label="发布" col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => openModel(m.url)}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-3 py-3 max-w-[320px]">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: VENDOR_COLOR[m.vendor_slug] || '#94a3b8' }}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              {m.name}
                              <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                              {m.vendor}
                              {(m.description_zh || m.description) && (
                                <span className="hidden md:inline"> · {m.description_zh || m.description}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatContext(m.context_length)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        <span className={m.price_in === 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-700 dark:text-slate-200'}>
                          {formatPrice(m.price_in)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        <span className={m.price_out === 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-700 dark:text-slate-200'}>
                          {formatPrice(m.price_out)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">{modalityLabel(m)}</span>
                          <span className="flex items-center gap-1">
                            {m.input_modalities.includes('image') && (
                              <Eye className="w-3.5 h-3.5 text-violet-500" aria-label="视觉" />
                            )}
                            {m.supports_tools && (
                              <Wrench className="w-3.5 h-3.5 text-sky-500" aria-label="工具调用" />
                            )}
                            {m.supports_reasoning && (
                              <Brain className="w-3.5 h-3.5 text-amber-500" aria-label="推理" />
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(m.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-violet-500" />视觉</span>
              <span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5 text-sky-500" />工具</span>
              <span className="inline-flex items-center gap-1"><Brain className="w-3.5 h-3.5 text-amber-500" />推理</span>
              <span>价格单位：美元 / 100 万 tokens</span>
            </div>
            {data?.generated_at && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <ExternalLink className="w-3 h-3" />
                数据更新于 {new Date(data.generated_at).toLocaleString('zh-CN')} · 来源 {data.source}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
