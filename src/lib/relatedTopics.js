/** Convert the engine's related-topic section into questions, not duplicate prose. */
export function relatedTopicReply(answer) {
  const text = String(answer || '')
  const heading = /(?:^|\n)[ \t]*(?:#{1,4}[ \t]*)?(?:\*\*)?(?:Mga kaugnay na paksa|Kaugnay na mga paksa|Related topics|Related questions)(?:\*\*)?[ \t]*:?[ \t]*(?:\*\*)?[ \t]*\r?\n/i
  const match = heading.exec(text)
  if (!match) return { text, topics: [] }
  const start = match.index + match[0].length
  const remainder = text.slice(start)
  const sourceStart = remainder.search(/(?:^|\n)[ \t]*(?:Sources|Pinagmulan):/i)
  const topicText = sourceStart < 0 ? remainder : remainder.slice(0, sourceStart)
  const lines = topicText.split(/\r?\n/).filter(line => line.trim())
  // Only extract an actual list; leave unexpected model formatting untouched.
  if (!lines.length || lines.some(line => !/^\s*(?:[-*•]|\d+[.)])\s+/.test(line))) return { text, topics: [] }
  const topics = [...new Set(lines.map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/\[\d+\]/g, '').replace(/\*\*/g, '').trim()).filter(Boolean))].slice(0, 3)
  return { text: text.slice(0, match.index).trimEnd() + (sourceStart < 0 ? '' : '\n\n' + remainder.slice(sourceStart).trim()), topics }
}
