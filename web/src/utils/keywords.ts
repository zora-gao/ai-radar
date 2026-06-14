/**
 * 从标题中提取主题关键词标签（纯本地词库匹配，不依赖网络/AI）。
 *
 * 作为「内容概览」的替代：因数据仅有标题、无正文，
 * 这里从标题命中预置词库，给出 1-4 个主题标签，帮助快速识别内容方向。
 */

// 关键词词库：key 为展示用的规范标签，value 为命中用的别名（不区分大小写）
const KEYWORD_GROUPS: Array<{ label: string; aliases: string[] }> = [
  // 模型 / 厂商
  { label: 'GPT', aliases: ['gpt', 'chatgpt'] },
  { label: 'Claude', aliases: ['claude', 'anthropic'] },
  { label: 'Gemini', aliases: ['gemini'] },
  { label: 'DeepSeek', aliases: ['deepseek', '深度求索'] },
  { label: 'OpenAI', aliases: ['openai'] },
  { label: 'Llama', aliases: ['llama'] },
  { label: 'Qwen', aliases: ['qwen', '通义', '千问'] },
  { label: '豆包', aliases: ['豆包', 'doubao'] },
  { label: 'Hugging Face', aliases: ['hugging face', 'huggingface'] },
  { label: 'Sora', aliases: ['sora'] },
  { label: 'Midjourney', aliases: ['midjourney'] },

  // 概念
  { label: '大模型', aliases: ['大模型', 'llm', 'foundation model'] },
  { label: 'Agent', aliases: ['agent', '智能体', '多智能体'] },
  { label: '多模态', aliases: ['多模态', 'multimodal'] },
  { label: 'AIGC', aliases: ['aigc'] },
  { label: 'Prompt', aliases: ['prompt', '提示词'] },
  { label: '微调', aliases: ['微调', 'fine-tune', 'finetune', 'sft', 'lora'] },
  { label: '推理', aliases: ['推理', 'inference', 'reasoning'] },
  { label: 'RAG', aliases: ['rag', '检索增强'] },
  { label: 'Transformer', aliases: ['transformer'] },
  { label: 'Diffusion', aliases: ['diffusion', '扩散'] },
  { label: '机器学习', aliases: ['机器学习', 'machine learning'] },
  { label: '深度学习', aliases: ['深度学习', 'deep learning'] },
  { label: '人工智能', aliases: ['人工智能', 'artificial intelligence'] },

  // 硬件 / 算力
  { label: 'GPU', aliases: ['gpu', 'cuda', 'nvidia', '英伟达'] },
  { label: '芯片', aliases: ['芯片', 'chip', 'semiconductor', 'npu'] },
  { label: '算力', aliases: ['算力'] },

  // 机器人 / 具身
  { label: '机器人', aliases: ['机器人', 'robot', 'robotics'] },
  { label: '具身智能', aliases: ['具身', 'embodied'] },
  { label: '自动驾驶', aliases: ['自动驾驶', 'autonomous', '智驾'] },

  // 工程 / 生态
  { label: '开源', aliases: ['开源', 'open source', 'open-source'] },
  { label: '编程', aliases: ['编程', '代码', 'coding', 'code', '程序员', '前端', '后端'] },
  { label: '融资', aliases: ['融资', '估值', '亿美元', '亿元', 'ipo', '上市'] },
  { label: '发布', aliases: ['发布', '上线', '正式推出', 'release', 'launch'] },
]

/**
 * 提取关键词标签
 * @param text 用于匹配的文本（一般传清洗后的标题）
 * @param max 最多返回多少个标签
 */
export function extractKeywords(text: string, max = 4): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const hits: string[] = []

  for (const group of KEYWORD_GROUPS) {
    if (hits.includes(group.label)) continue
    const matched = group.aliases.some((a) => lower.includes(a.toLowerCase()))
    if (matched) {
      hits.push(group.label)
      if (hits.length >= max) break
    }
  }

  return hits
}
