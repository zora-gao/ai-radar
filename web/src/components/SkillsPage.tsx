import { useState } from 'react'
import {
  Flame,
  Star,
  Github,
  RefreshCw,
  Loader2,
  ChevronRight,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import type { SkillItem } from '../types/skills'
import { useSkillsData } from '../hooks/useSkillsData'

interface SkillsPageProps {
  active: boolean
  onBackHome: () => void
}

function formatStars(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return String(n)
}

const LANG_COLOR: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  Shell: '#89e051',
  Jupyter: '#DA5B0B',
  Vue: '#41b883',
  HTML: '#e34c26',
}

function SkillCard({ skill }: { skill: SkillItem }) {
  const [showReadme, setShowReadme] = useState(false)
  const body = skill.description_zh || skill.description || '（暂无描述）'
  const readme = skill.readme_excerpt_zh || skill.readme_excerpt
  const langColor = (skill.language && LANG_COLOR[skill.language]) || '#94a3b8'

  const openGithub = () => window.open(skill.html_url, '_blank', 'noopener,noreferrer')

  return (
    <div
      onClick={openGithub}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openGithub()
      }}
      className="card card-hover cursor-pointer p-5 flex flex-col gap-3 group"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
          {skill.display_name}
        </h3>
        <Github className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1">
          <Star className="w-3 h-3 fill-current" />
          {formatStars(skill.stars)}
        </span>
        {skill.stars_7d != null && skill.stars_7d > 0 && (
          <span className="badge bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300 gap-1">
            <Flame className="w-3 h-3" />+{skill.stars_7d} (7d)
          </span>
        )}
        {skill.language && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: langColor }} />
            {skill.language}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
        {body}
      </p>

      {skill.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.topics.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {readme && (
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowReadme((v) => !v)
            }}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary-500 transition-colors"
          >
            <span>README 预览</span>
            <span className="flex items-center gap-1">
              {showReadme ? '收起' : 'Show'}
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform ${showReadme ? 'rotate-90' : ''}`}
              />
            </span>
          </button>
          {showReadme && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
              {readme}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function SkillsPage({ active, onBackHome }: SkillsPageProps) {
  const { data, loading, error, refresh } = useSkillsData(active)
  const items = data?.items ?? []

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* 标题区 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Skills 技能库探索
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            发现并追踪 AI Agent 技能、MCP 工具与热门插件更新，助力 AI 应用落地。数据实时来自
            GitHub，描述已翻译为中文，点击卡片可跳转 GitHub 仓库。
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {data?.count ?? 0} Skills
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="btn btn-ghost border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm flex items-center gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
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
        <span className="text-slate-600 dark:text-slate-300 font-medium">Skills</span>
      </div>

      {/* 内容 */}
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
          <p className="text-sm">正在从 GitHub 加载热门 Skills…</p>
        </div>
      ) : (
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Flame className="w-5 h-5 text-rose-500" />
              近期热门 Skills
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-3 py-1 rounded-full">
              共 {items.length} 个仓库 · 按近7日增量排序
            </span>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              暂无数据，请运行 <code className="px-1 bg-slate-100 dark:bg-slate-700 rounded">npm run fetch:skills</code> 生成。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          )}

          {data?.generated_at && (
            <div className="mt-5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <ExternalLink className="w-3 h-3" />
              数据更新于 {new Date(data.generated_at).toLocaleString('zh-CN')}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
