import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://biaqsosjorxklbtptdqy.supabase.co'
const supabaseAnonKey = 'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function getRoots(word) {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  const roots = [clean]

  if (clean.endsWith('ng') && clean.length > 4) {
    roots.push(clean.slice(0, -2))
  }

  const unInfixed = clean.replace(/^([bcdfghjklmnpqrstvwxyz])um([aeiou])/i, '$1$2')
  if (unInfixed !== clean) {
    roots.push(unInfixed)
  }

  const inInfixed = clean.replace(/^([bcdfghjklmnpqrstvwxyz])in([aeiou])/i, '$1$2')
  if (inInfixed !== clean) {
    roots.push(inInfixed)
  }

  const pagStripped = clean.replace(/^(pagka|paga|pag|mag|nag|pan|pam|pang)/i, '')
  if (pagStripped.length >= 3 && pagStripped !== clean) {
    roots.push(pagStripped)
  }

  return [...new Set(roots)]
}

async function testSearch(query) {
  const { data: docs } = await supabase.from('documents').select('*')
  const officialDocs = docs.filter(d => d.approval_status === 'Approved')
  
  const qLower = query.toLowerCase()
  const stopWords = new Set([
    'paano', 'kailan', 'bawal', 'bakit', 'saan', 'magkano', 'ano', 'ating',
    'para', 'mga', 'nang', 'sang', 'meron', 'mayroon', 'natin', 'inyo',
    'po', 'ba', 'ng', 'sa', 'at', 'ang', 'na', 'ay', 'ito', 'kung', 'kayo', 'kami',
    'what', 'how', 'when', 'where', 'why', 'the', 'and', 'for', 'with', 'from', 'about',
    'sino', 'sinu', 'sino-sino', 'sinu-sino', 'pwede', 'pwedeng', 'puwede', 'puwedeng',
    'sila', 'siya', 'niya', 'kanila', 'nila'
  ])

  const rawWords = qLower
    .replace(/[^\w\s\u00C0-\u017F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)

  const queryWords = rawWords.filter((w) => !stopWords.has(w))

  const searchRoots = []
  for (const w of queryWords) {
    searchRoots.push(...getRoots(w))
  }
  const uniqueRoots = [...new Set(searchRoots)].filter(r => r.length >= 3)

  const isParticipationIntent = qLower.includes('sali') || qLower.includes('lahok') || qLower.includes('puno') || (qLower.includes('sino') && (qLower.includes('pwede') || qLower.includes('kalahok')))
  const isScheduleIntent = qLower.includes('kailan') || qLower.includes('oras') || qLower.includes('araw') || qLower.includes('iskedyul') || qLower.includes('petsa')
  const isLocationIntent = qLower.includes('saan') || qLower.includes('lokasyon') || qLower.includes('lugar')
  const isPrizeIntent = qLower.includes('premyo') || qLower.includes('panalo') || qLower.includes('kampeon') || qLower.includes('gantimpala') || (qLower.includes('magkano') && !qLower.includes('bayad'))

  const matchedSources = []
  for (const doc of officialDocs) {
    const docTextHeader = `${doc.title} ${doc.category || ''} ${doc.summary || ''}`.toLowerCase()
    const docLevelMatches = uniqueRoots.filter(r => docTextHeader.includes(r)).length

    if (doc.sections && doc.sections.length > 0) {
      for (const sec of doc.sections) {
        const secText = (sec.title + ' ' + sec.content).toLowerCase()
        const fullDocText = `${docTextHeader} ${secText}`.toLowerCase()

        let matchedCount = 0
        for (const root of uniqueRoots) {
          if (secText.includes(root)) {
            matchedCount += 2
          } else if (fullDocText.includes(root)) {
            matchedCount += 1
          }
        }

        // Strong boost if the document itself is specifically named in query
        if (docLevelMatches > 0) {
          matchedCount += docLevelMatches * 2
        }

        if (isParticipationIntent && (secText.includes('kwalipikasyon') || secText.includes('pagsali') || secText.includes('kalahok') || secText.includes('bukas'))) {
          matchedCount += 3
        }
        if (isLocationIntent && (secText.includes('lokasyon') || secText.includes('inspeksyon') || secText.includes('kalye') || secText.includes('court'))) {
          matchedCount += 3
        }
        if (isScheduleIntent && (secText.includes('iskedyul') || secText.includes('martes') || secText.includes('sabado') || secText.includes('oras'))) {
          matchedCount += 3
        }
        if (isPrizeIntent && (secText.includes('premyo') || secText.includes('kampeon') || secText.includes('₱') || secText.includes('cash'))) {
          matchedCount += 3
        }

        let calculatedScore = 0.50
        if (matchedCount >= 3) {
          calculatedScore = Math.min(0.96, 0.78 + matchedCount * 0.02)
        } else if (matchedCount >= 1) {
          calculatedScore = Math.min(0.72, 0.60 + matchedCount * 0.05)
        }

        if (calculatedScore >= 0.73) {
          matchedSources.push({
            docTitle: doc.title,
            sectionTitle: sec.title,
            content: sec.content,
            score: calculatedScore,
            rawScore: matchedCount,
          })
        }
      }
    }
  }

  matchedSources.sort((a, b) => b.rawScore - a.rawScore)
  console.log('Query:', query)
  if (matchedSources.length > 0) {
    console.log('TOP MATCH:', matchedSources[0].docTitle, '-', matchedSources[0].sectionTitle, `(${(matchedSources[0].score * 100).toFixed(0)}%)`)
    console.log('CONTENT:', matchedSources[0].content.substring(0, 140) + '...')
  } else {
    console.log('NO MATCHES ABOVE THRESHOLD (0.73)!')
  }
}

async function run() {
  await testSearch('Saan po lokasyon ng tapat ko, linis ko?')
  console.log('----------------------------')
  await testSearch('sino sino ang pwedeng sumali?')
}

run()
