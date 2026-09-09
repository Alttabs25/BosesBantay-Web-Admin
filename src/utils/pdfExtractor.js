import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

/**
 * Extracts plain text from an uploaded PDF, DOCX, text, or markdown file.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromFile(file) {
  if (!file) return ''

  const name = file.name.toLowerCase()

  // 1. Plain text & Markdown files
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    try {
      return await file.text()
    } catch (e) {
      console.warn('Text file read error:', e)
    }
  }

  // 2. PDF Files via pdfjs-dist
  if (name.endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      let fullText = ''

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageStrings = textContent.items.map((item) => item.str).join(' ')
        fullText += pageStrings + '\n\n'
      }

      const cleaned = fullText.trim()
      if (cleaned.length > 10) {
        return cleaned
      }
    } catch (err) {
      console.warn('PDF text extraction error:', err)
    }
  }

  // 3. Microsoft Word (.docx) Files via mammoth
  if (name.endsWith('.docx')) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      if (result && result.value && result.value.trim().length > 10) {
        return result.value.trim()
      }
    } catch (err) {
      console.warn('DOCX text extraction error:', err)
    }
  }

  return ''
}

/**
 * Parses raw text into structured RAG sections/chunks for indexing.
 * Automatically recognizes headings like "MGA KWALIPIKASYON:", "ISKEDYUL AT LOKASYON:", etc.
 * @param {string} rawText
 * @param {string} docTitle
 * @returns {Array<{title: string, content: string}>}
 */
export function parseDocumentSections(rawText, docTitle = 'Dokumento') {
  if (!rawText || !rawText.trim()) {
    return [
      {
        title: 'Seksyon 1: Pamagat at Pangkalahatang Saklaw',
        content: `Opisyal na dokumento ukol sa ${docTitle}.`,
      },
      {
        title: 'Seksyon 2: Mga Alituntunin at Probisyon',
        content: 'Lahat ng kinauukulan ay inaatasang sumunod sa mga nakasaad na alituntunin at probisyon sa dokumentong ito.',
      }
    ]
  }

  const text = rawText.trim()

  // Match common headings: e.g. "MGA KWALIPIKASYON SA PAGSALI:", "ISKEDYUL AT LOKASYON:", "PREMYO:", "Seksyon 1:", "Section 1:"
  const headingRegex = /(?:^|\n)([A-Z\s"'\(\)\-–]{4,}:|Seksyon\s+\d+[^:\n]*:|Section\s+\d+[^:\n]*:|ARTICLE\s+[IVXLCDM\d]+[^:\n]*:)/g
  const matches = [...text.matchAll(headingRegex)]

  if (matches.length >= 2) {
    const sections = []
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i]
      const heading = currentMatch[1].replace(/:$/, '').trim()
      const startIndex = currentMatch.index + currentMatch[0].length
      const endIndex = i + 1 < matches.length ? matches[i + 1].index : text.length
      const body = text.substring(startIndex, endIndex).trim()

      if (body.length > 0) {
        const cleanHeading = heading.startsWith('Seksyon') || heading.startsWith('Section')
          ? heading
          : `Seksyon ${i + 1}: ${heading}`
        sections.push({
          title: cleanHeading,
          content: body,
        })
      }
    }

    if (sections.length > 0) {
      return sections
    }
  }

  // Fallback: Split by double newlines into paragraphs
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 15)

  if (paragraphs.length >= 2) {
    return paragraphs.map((p, idx) => {
      const lines = p.split('\n')
      const firstLine = lines[0].replace(/:$/, '').trim()
      const hasHeading = firstLine.length < 70 && (firstLine === firstLine.toUpperCase() || firstLine.includes('Seksyon') || firstLine.includes('Section'))
      return {
        title: hasHeading ? `Seksyon ${idx + 1}: ${firstLine}` : `Seksyon ${idx + 1}: Alituntunin at Detalye`,
        content: hasHeading && lines.length > 1 ? lines.slice(1).join(' ').trim() : p,
      }
    })
  }

  // Final fallback for short single paragraph
  return [
    {
      title: 'Seksyon 1: Pamagat at Saklaw',
      content: text,
    }
  ]
}
