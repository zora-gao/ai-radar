export interface ModelItem {
  id: string
  name: string
  vendor: string
  vendor_slug: string
  url: string
  created_at: string | null
  context_length: number | null
  modality: string | null
  input_modalities: string[]
  output_modalities: string[]
  /** 输入价格：美元 / 100 万 tokens；null 表示不可用/动态 */
  price_in: number | null
  /** 输出价格：美元 / 100 万 tokens；null 表示不可用/动态 */
  price_out: number | null
  is_free: boolean
  supports_tools: boolean
  supports_reasoning: boolean
  description: string | null
  description_zh: string | null
}

export interface ModelsData {
  generated_at: string
  source: string
  count: number
  items: ModelItem[]
}
