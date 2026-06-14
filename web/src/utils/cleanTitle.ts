/**
 * 标题清洗：把营销号风格的标题洗成精炼、克制的陈述句。
 *
 * 纯字符串规则，不依赖网络/AI。处理内容：
 * - 去除 emoji / 颜文字符号
 * - 去除 @提及、#话题#、【】栏目标记里的纯噪声
 * - 去除营销口水词（原来是…啊 / 竟然 / 震惊 / 我去查了查 等）
 * - 收敛连续标点（!!! → ！，。。。 → 。）
 * - 压缩多余空格、去首尾杂符
 */

// 营销/口水短语：直接整体删除（按出现位置去掉，保留剩余语义）
const FILLER_PHRASES: RegExp[] = [
  /原来是/g,
  /竟然(是|有|能|会)?/g,
  /居然(是|有|能|会)?/g,
  /震惊[，,!！]?/g,
  /我(去|又)?查了查/g,
  /我(去|又)?试了试/g,
  /你(绝对)?(万万)?想不到/g,
  /没想到/g,
  /万万没想到/g,
  /太(炸|绝|强|猛|秀)了/g,
  /绝了/g,
  /逆天了?/g,
  /破防了?/g,
  /狠狠(地)?/g,
  /yyds/gi,
  /amazing/gi,
  /奥利给/g,
  /划重点/g,
  /敲黑板/g,
  /建议(收藏|码住)/g,
  /码住/g,
  /速看/g,
  /快(来|看)/g,
  /必看/g,
  /干货(满满|分享|来了)?/g,
  /重磅[，,!！]?/g,
  /突发[，,!！]?/g,
  /刚刚[，,!！]?/g,
]

// 语气尾词/语气助词：出现在词尾时去掉
const TAIL_PARTICLES: RegExp[] = [
  /[啊呀哇呢吧啦哦喔嘛咯嘞]+(?=[，,。.!！?？\s]|$)/g,
]

// 颜文字/特殊装饰符号
const DECOR_SYMBOLS = /[★☆◆◇■□▶►▷●○♦♥♡✨✦✧❗❓‼⁉～~]+/g

/**
 * 去除 emoji（含大部分 Unicode emoji 区段）
 */
function stripEmoji(s: string): string {
  return s.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu,
    ''
  )
}

export function cleanTitle(raw: string): string {
  if (!raw) return ''
  let s = raw

  // 1. 去 emoji 与装饰符号
  s = stripEmoji(s)
  s = s.replace(DECOR_SYMBOLS, ' ')

  // 2. 去 @提及（@xxx，到空格/标点为止）
  s = s.replace(/@[^\s，,。.!！?？:：、]+/g, ' ')

  // 3. 去 #话题#（成对的 #...# 或行尾 #话题）
  s = s.replace(/#[^#\s]+#/g, ' ')
  s = s.replace(/#[^\s#]+/g, ' ')

  // 4. 去营销口水短语
  for (const re of FILLER_PHRASES) {
    s = s.replace(re, '')
  }

  // 5. 去尾部语气助词
  for (const re of TAIL_PARTICLES) {
    s = s.replace(re, '')
  }

  // 6. 收敛连续标点
  s = s.replace(/[!！]{2,}/g, '！')
  s = s.replace(/[?？]{2,}/g, '？')
  s = s.replace(/[。.]{2,}/g, '。')
  s = s.replace(/[,，]{2,}/g, '，')
  s = s.replace(/[、]{2,}/g, '、')

  // 7. 压缩空格、去首尾杂符
  s = s.replace(/\s{2,}/g, ' ').trim()
  // 去掉开头残留的标点/分隔
  s = s.replace(/^[\s，,。.!！?？:：、\-—|]+/, '')
  // 去掉结尾多余的逗号/顿号/空格
  s = s.replace(/[\s，,、]+$/, '')

  // 8. 兜底：若清洗后为空（极端情况），回退原标题去 emoji 版本
  if (!s.trim()) {
    s = stripEmoji(raw).trim()
  }

  return s
}
