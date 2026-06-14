export interface SkillItem {
  id: string
  name: string
  display_name: string
  owner: string
  full_name: string
  html_url: string
  homepage: string | null
  stars: number
  stars_7d: number | null
  language: string | null
  topics: string[]
  description: string | null
  description_zh: string | null
  readme_excerpt: string | null
  readme_excerpt_zh: string | null
  pushed_at: string | null
  updated_at: string | null
}

export interface SkillsData {
  generated_at: string
  count: number
  items: SkillItem[]
}
