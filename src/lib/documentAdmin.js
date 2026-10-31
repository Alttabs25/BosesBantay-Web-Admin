const base = (import.meta.env.VITE_DOCUMENT_ADMIN_URL || '/api/document-admin').replace(/\/$/, '')
export async function documentRequest(path, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), path === '/index' ? 15 * 60 * 1000 : path === '/services/action' ? 3 * 60 * 1000 : ['/summary','/chatbot/test','/chatbot/message'].includes(path) ? 6 * 60 * 1000 : 60000)
  const send = () => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal })
  try {
    const response = await send()
    const result = await response.json().catch(() => null)
    if (!response.ok || !result) throw Object.assign(new Error(result?.error || 'Document service is unavailable. Please retry.'), { status: response.status })
    return result
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The lookup timed out. Check the library before retrying an upload.')
    if (error instanceof TypeError) throw new Error('Cannot reach the document service. Check its connection and retry.')
    throw error
  } finally { clearTimeout(timeout) }
}

export async function filePayload(file) {
  if (!/\.(pdf|txt)$/i.test(file.name)) throw new Error('Choose a searchable PDF or UTF-8 TXT file.')
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose a non-empty file up to 20 MB.')
  const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Unable to read this file.')); reader.readAsDataURL(file) })
  return { filename: file.name, data }
}
