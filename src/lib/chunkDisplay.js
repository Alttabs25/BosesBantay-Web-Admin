// Presentation only: never rewrite indexed evidence or citation metadata.
export function chunkParagraphs(value) {
  const text = String(value || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const short = lines.filter(line => line.length < 22 && line.split(/\s+/).length <= 2).length
  // Some PDF extractors put blank lines between every word, so splitting on
  // blank lines alone still produces hundreds of one-word paragraphs.
  if (lines.length >= 20 && short / lines.length >= .85) {
    return [lines.join(' ').replace(/\s+/g, ' ')]
  }
  return text.split(/\n[ \t]*\n/).map(part => part.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
}
