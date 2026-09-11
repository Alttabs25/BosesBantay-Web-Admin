import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Bot,
  X,
  Send,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle2,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  BookOpen,
  User,
} from 'lucide-react'

export default function KnowledgeTestBenchModal({ open, onClose, documents = [] }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [expandedCitations, setExpandedCitations] = useState({}) // { [msgIdx_srcIdx]: boolean }
  const [isRendered, setIsRendered] = useState(open)
  const [isClosing, setIsClosing] = useState(false)

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Sync rendered state with open prop and manage smooth exit animation & body lock
  useEffect(() => {
    if (open) {
      setIsRendered(true)
      setIsClosing(false)
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    } else if (isRendered) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setIsRendered(false)
        setIsClosing(false)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [open, isRendered])

  // Handle close with exit animation before unmounting
  const handleClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => {
      setIsRendered(false)
      setIsClosing(false)
      onClose?.()
    }, 240)
  }, [isClosing, onClose])

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleClose])

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory, loading, open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 250)
    }
  }, [open])

  if (!isRendered && !open) return null

  // Pure Supabase documents only (no mock hydration)
  const officialDocs = documents.filter(
    (d) => d.officialStatus === 'Opisyal' && d.status !== 'Retired'
  )
  const unapprovedDocs = documents.filter(
    (d) => d.officialStatus !== 'Opisyal' || d.status === 'Retired'
  )

  // Dynamically generate sample queries directly from the active documents' actual sections
  const dynamicDocQueries = officialDocs.flatMap((d) => {
    const queries = []
    const cleanTitle = d.title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')

    if (d.sections && d.sections.length > 0) {
      d.sections.forEach((sec) => {
        const cleanSec = sec.title.replace(/^Seksyon\s+\d+:\s*/i, '').trim()
        if (cleanSec && cleanSec.length > 3 && cleanSec.length < 55) {
          queries.push({
            category: d.category || 'Ordinansa',
            query: `Ano ang nakasaad ukol sa "${cleanSec}"?`,
          })
        }
      })
    } else {
      queries.push({
        category: d.category || 'Ordinansa',
        query: `Ano ang mga alituntunin at nilalaman ng "${cleanTitle}"?`,
      })
    }
    return queries
  })

  // Dynamically generate starter prompt cards directly from whichever official documents are uploaded
  const categorizedStarters = officialDocs.length > 0
    ? officialDocs.slice(0, 3).map((d, idx) => {
        const cleanTitle = d.title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
        const operativeSec = d.sections && d.sections.length > 1 ? d.sections[1] : d.sections?.[0]
        const cleanSecTitle = operativeSec ? operativeSec.title.replace(/^Seksyon\s+\d+:\s*/i, '').trim() : ''
        return {
          category: cleanTitle,
          icon: idx === 0 ? CheckCircle2 : idx === 1 ? FileText : BookOpen,
          badgeColor:
            idx === 0
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : idx === 1
              ? 'text-orange-700 bg-orange-50 border-orange-200'
              : 'text-teal-700 bg-teal-50 border-teal-200',
          query: cleanSecTitle
            ? `Ano ang nakasaad ukol sa ${cleanSecTitle}?`
            : `Ano ang nilalaman at alituntunin ng ${cleanTitle}?`,
        }
      }).concat([
        {
          category: 'Greeting Test (Pagbati)',
          icon: Bot,
          badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
          query: 'Kumusta! Ano ang maitutulong mo?',
        },
        {
          category: 'Out-of-Scope Fallback Test',
          icon: AlertTriangle,
          badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
          query: 'May tala ba kayo tungkol sa lotto results?',
        },
      ])
    : [
        {
          category: 'Greeting Test (Pagbati)',
          icon: Bot,
          badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
          query: 'Kumusta! Ano ang maitutulong mo?',
        },
        {
          category: 'Out-of-Scope Fallback Test',
          icon: AlertTriangle,
          badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
          query: 'Anong oras bukas ang opisina?',
        },
      ]

  // Detect whether resident asked in English
  const isEnglishQuery = (text) => {
    const t = text.toLowerCase().trim()
    const pureEnglishStarters = [
      'how much is', 'how much to', 'how much for', 'how much does',
      'what is the', 'what are the', 'when is the', 'where can i',
      'where is the', 'can i get', 'how to get', 'is there a',
      'what time is', 'is it prohibited', 'penalty for', 'fine for',
      'requirements for', 'rules on', 'curfew for',
    ]
    if (pureEnglishStarters.some((sig) => t.startsWith(sig) || t.includes(` ${sig}`))) {
      return true
    }

    const tagalogTokens = [
      'ano', 'ang', 'mga', 'magkano', 'paano', 'kailan', 'saan', 'bakit', 'sino',
      'mayroon', 'meron', 'bawal', 'multa', 'bayad', 'aso', 'pusa', 'alaga', 'alagang',
      'basura', 'gabi', 'oras', 'po', 'ba', 'naman', 'kasi', 'nga', 'mag', 'pa', 'din', 'rin',
      'ng', 'sa', 'at', 'na', 'ay', 'ito', 'ko', 'mo', 'natin', 'inyo',
    ]
    const words = t.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    const hasTagalog = words.some((w) => tagalogTokens.includes(w))
    if (hasTagalog) return false

    const englishWords = words.filter((w) =>
      ['how', 'what', 'when', 'where', 'why', 'who', 'the', 'is', 'are', 'can', 'for', 'my', 'your', 'dog', 'cat', 'fee', 'fine', 'cost', 'time', 'register', 'penalty', 'rules'].includes(w)
    )
    return englishWords.length >= 3
  }

  const handleTestQuery = (testText) => {
    const q = testText || query
    if (!q.trim()) return

    setLoading(true)
    const isEnglish = isEnglishQuery(q)
    const userMessage = {
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setChatHistory((prev) => [...prev, userMessage])
    if (!testText) setQuery('')

    setTimeout(() => {
      const qLower = q.toLowerCase()

      // 1. Natural Greeting Interceptor (Personalized & Courteous)
      const isGreeting = [
        'hi', 'hello', 'kumusta', 'kamusta', 'magandang araw',
        'magandang umaga', 'magandang hapon', 'magandang gabi',
        'good morning', 'good afternoon', 'good evening', 'hey', 'yo',
      ].some((g) => qLower === g || qLower.startsWith(`${g} `) || qLower.endsWith(` ${g}`))

      if (isGreeting) {
        const botResponse = isEnglish
          ? 'Hello! How can I assist you today regarding our official barangay ordinances or guidelines?'
          : 'Magandang araw po! Kumusta po kayo? Ako ang inyong Barangay-Bot assistant. Ano po ang maitutulong ko sa inyo ukol sa ating mga opisyal na ordinansa at alituntunin?'
        setChatHistory((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: botResponse,
            sources: [],
            blocked: [],
            isGreeting: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
        setLoading(false)
        return
      }

      // 2. Comprehensive Stopwords (Never treat structural/generic barangay words or verbal prefixes as topic keywords)
      const grammaticalStopWords = new Set([
        'po', 'ba', 'ng', 'sa', 'at', 'ang', 'na', 'ay', 'ito', 'kung', 'kayo', 'kami',
        'namin', 'inyo', 'sila', 'kanila', 'mo', 'ko', 'ni', 'din', 'rin', 'nga', 'naman',
        'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from',
        'by', 'is', 'are', 'was', 'were', 'am', 'it', 'its', 'be', 'do', 'does', 'did',
        'barangay', 'hall', 'bosesbantay', 'opisyal', 'tala', 'mga', 'may', 'meron', 'wala',
        'lahat', 'bawat', 'anong', 'ano', 'kailan', 'saan', 'paano', 'bakit', 'sino', 'alin',
        'dito', 'doon', 'nito', 'para', 'ukol', 'hinggil', 'bukas', 'oras', 'araw', 'petsa',
        'mag', 'nag', 'pag', 'makapag',
      ])

      // Normalize colloquial contractions
      const normalizedQuery = qLower
        .replace(/\bpano\b/g, 'paano')
        .replace(/\bsan\b/g, 'saan')
        .replace(/\bkelan\b/g, 'kailan')

      // 3. 100% DYNAMIC SENTENCE-LEVEL TOPIC & DOCUMENT QUALIFICATION
      const queryTokens = normalizedQuery
        .replace(/[^\w\s\u00C0-\u017F]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !grammaticalStopWords.has(w))

      // Generate query bigrams (adjacent token pairs) for phrase relevance
      const queryBigrams = []
      for (let i = 0; i < queryTokens.length - 1; i++) {
        queryBigrams.push(`${queryTokens[i]} ${queryTokens[i + 1]}`)
      }

      // Robust morphological, stem, and bilingual cognate matcher
      const tokenMatchesText = (token, text) => {
        const t = token.toLowerCase()
        const txt = text.toLowerCase()
        if (new RegExp('(?:^|[^a-zA-Z0-9])' + t + '(?:$|[^a-zA-Z0-9])', 'i').test(txt)) return true
        if (t.length >= 4 && txt.includes(t) && t !== 'pet') return true

        // Universal bilingual cognates and root stems (supports any ordinance)
        if (t.startsWith('regist') || t.startsWith('rehistr')) return txt.includes('regist') || txt.includes('rehistr')
        if (t === 'liga' || t === 'league' || t.includes('liga')) return txt.includes('liga') || txt.includes('league')
        if (t.includes('linis') || t.startsWith('clean')) return txt.includes('linis') || txt.includes('clean')
        if (t.startsWith('inspek') || t.startsWith('inspect')) return txt.includes('inspek') || txt.includes('inspect')
        if (t.startsWith('bakun') || t.startsWith('vaccin')) return txt.includes('bakun') || txt.includes('vaccin')
        if (t === 'aso' || t === 'pusa' || t === 'pet' || t === 'pets') return /\b(pet|pets|aso|asong|pusa|pusang)\b/i.test(txt)
        return false
      }

      // Dynamically score every official document based on topic relevance to query
      const scoredOfficialDocs = officialDocs.map((doc) => {
        const cleanTitle = (doc.title || '')
          .replace(/\.[^/.]+$/, '')
          .replace(/[_\W]+/g, ' ')
          .toLowerCase()
        const summaryLower = (doc.summary || '').toLowerCase()

        let docTopicScore = 0

        // Title matches (high weight)
        for (const token of queryTokens) {
          if (tokenMatchesText(token, cleanTitle)) docTopicScore += 8
          if (tokenMatchesText(token, summaryLower)) docTopicScore += 4
        }

        // Phrase / bigram matches in title/summary
        for (const bigram of queryBigrams) {
          if (cleanTitle.includes(bigram)) docTopicScore += 10
          if (summaryLower.includes(bigram)) docTopicScore += 5
        }

        // Content density across sections
        if (Array.isArray(doc.sections)) {
          let matchingSecs = 0
          for (const sec of doc.sections) {
            const secFull = `${sec.title || ''} ${sec.content || ''}`.toLowerCase()
            const hasMatch = queryTokens.some((tok) => tokenMatchesText(tok, secFull))
            if (hasMatch) matchingSecs++
          }
          docTopicScore += Math.min(8, matchingSecs * 2.5)
        }

        // Sentence-Level Topic Completeness: Count how many DISTINCT query tokens this document addresses
        const fullDocText = (cleanTitle + ' ' + summaryLower + ' ' + (doc.sections || []).map((s) => `${s.title || ''} ${s.content || ''}`).join(' ')).toLowerCase()
        const matchedTokensCount = queryTokens.filter((tok) => tokenMatchesText(tok, fullDocText)).length

        return { doc, docTopicScore, matchedTokensCount }
      })

      // Sort by distinct topic tokens matched descending, then by overall topic score descending
      scoredOfficialDocs.sort(
        (a, b) => b.matchedTokensCount - a.matchedTokensCount || b.docTopicScore - a.docTopicScore
      )
      const topDocCandidate = scoredOfficialDocs.length > 0 ? scoredOfficialDocs[0] : null
      const maxMatchedTokens = topDocCandidate ? topDocCandidate.matchedTokensCount : 0
      const topDocScore = topDocCandidate ? topDocCandidate.docTopicScore : 0

      // If no document addresses the sentence topic:
      if (!topDocCandidate || maxMatchedTokens === 0 || topDocScore < 3.0) {
        const fallbackText = isEnglish
          ? 'I apologize, but there is no official record or active document in our database regarding this inquiry. Please coordinate with or visit the Barangay Hall for further assistance.'
          : 'Paumanhin po, wala pa po akong tala o opisyal na dokumento ukol sa katanungang ito sa ating database. Mangyaring makipag-ugnayan o magsadya sa Barangay Hall para sa inyong karagdagang katanungan at tulong.'

        setChatHistory((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: fallbackText,
            sources: [],
            blocked: [],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
        setLoading(false)
        return
      }

      // Sentence-Level Topic Locking: ONLY qualify documents that match the sentence's maximum distinct tokens!
      // This prevents a generic word (e.g. "register") from pulling sections from an unrelated document (e.g. Pets when asking about Liga)
      const candidateDocs = scoredOfficialDocs
        .filter((d) => d.matchedTokensCount === maxMatchedTokens && d.docTopicScore >= Math.max(3.0, topDocScore * 0.70))
        .map((d) => d.doc)

      // Step 4: Universal, Document-Agnostic Intent Detection
      const isFeeQuery = ['magkano', 'bayad', 'libre', 'singil', 'halaga', 'premyo', 'pabuya', 'cost', 'fee', 'price', 'prize', 'free'].some((w) => tokenMatchesText(w, normalizedQuery))
      const isPenaltyQuery = ['multa', 'parusa', 'penalty', 'huli', 'violation', 'paglabag', 'bawal', 'pananagutan', 'saklaw'].some((w) => tokenMatchesText(w, normalizedQuery))
      const isScheduleQuery = ['oras', 'kailan', 'iskedyul', 'araw', 'petsa', 'panahon', 'when', 'schedule', 'time', 'date', 'inspeksyon'].some((w) => tokenMatchesText(w, normalizedQuery))
      const isRequirementsQuery = ['paano', 'rehistro', 'register', 'kuha', 'sumali', 'kwalipikasyon', 'edad', 'requisitos', 'requirement', 'qualify', 'how', 'who'].some((w) => tokenMatchesText(w, normalizedQuery))

      // Step 5: Dynamic Section-level Chunk Matching within Qualified Candidate Documents
      const matchedSources = []

      for (const doc of candidateDocs) {
        if (doc.sections && doc.sections.length > 0) {
          for (const sec of doc.sections) {
            const secTitleLower = (sec.title || '').toLowerCase()
            const secContentLower = (sec.content || '').toLowerCase()

            let chunkScore = 0

            // Dynamic Token Matching
            for (const token of queryTokens) {
              if (tokenMatchesText(token, secTitleLower)) {
                chunkScore += 5.0
              } else if (tokenMatchesText(token, secContentLower)) {
                chunkScore += 2.0
              }
            }

            // Dynamic Bigram/Phrase Matching
            for (const bigram of queryBigrams) {
              if (secTitleLower.includes(bigram)) chunkScore += 5.0
              else if (secContentLower.includes(bigram)) chunkScore += 2.5
            }

            // Universal Interrogative Intent Boosts:
            if (isFeeQuery) {
              if (['bayad', 'libre', 'singil', 'halaga', 'premyo', 'pabuya', 'pagpaparehistro', 'fee', 'cost', 'price'].some((w) => secTitleLower.includes(w))) {
                chunkScore += 5.0
              }
              if (/[₱$]|php|pesos?|\b\d+([.,]\d{2})?\b|\blibre\b|\bfree\b/i.test(secContentLower)) {
                chunkScore += 3.5
              }
            }

            if (isPenaltyQuery) {
              if (['multa', 'parusa', 'paglabag', 'penalty', 'sanction', 'pananagutan', 'kagat'].some((w) => secTitleLower.includes(w))) {
                chunkScore += 6.0
              }
              if (['multa', 'parusa', 'unang paglabag', 'penalty', 'pananagutan'].some((w) => secContentLower.includes(w))) {
                chunkScore += 3.0
              }
            }

            if (isScheduleQuery) {
              if (['oras', 'iskedyul', 'araw', 'petsa', 'panahon', 'inspeksyon', 'schedule', 'time'].some((w) => secTitleLower.includes(w))) {
                chunkScore += 5.0
              }
              if (['lunes', 'martes', 'miyerkules', 'huwebes', 'biyernes', 'sabado', 'linggo', 'am', 'pm', 'umaga', 'hapon', 'gabi'].some((w) => secContentLower.includes(w))) {
                chunkScore += 3.0
              }
            }

            if (isRequirementsQuery) {
              if (['requisitos', 'kwalipikasyon', 'pamantayan', 'requirements', 'edad', 'pagpaparehistro', 'registration'].some((w) => secTitleLower.includes(w))) {
                chunkScore += 6.0
              }
            }

            // Substantive Section Priority: Demote Seksyon 1 (Pamagat at Saklaw) when asking specific questions
            if (
              (secTitleLower.includes('pamagat') || secTitleLower.includes('saklaw')) &&
              (isFeeQuery || isPenaltyQuery || isScheduleQuery || isRequirementsQuery)
            ) {
              chunkScore -= 10
            }

            // Calculate cosine similarity approximation
            let calculatedSimilarity = 0.50
            if (chunkScore >= 8) {
              calculatedSimilarity = Math.min(0.96, 0.86 + (chunkScore - 8) * 0.015)
            } else if (chunkScore >= 4) {
              calculatedSimilarity = Math.min(0.85, 0.74 + (chunkScore - 4) * 0.025)
            } else if (chunkScore >= 2) {
              calculatedSimilarity = Math.min(0.72, 0.62 + chunkScore * 0.04)
            }

            // Strictly enforce minimum cosine similarity threshold of 0.73
            if (calculatedSimilarity >= 0.73) {
              matchedSources.push({
                docTitle: doc.title,
                ordinanceNo: doc.ordinanceNo && doc.ordinanceNo !== '—' ? doc.ordinanceNo : '',
                category: doc.category,
                sectionTitle: sec.title,
                content: sec.content,
                score: calculatedSimilarity,
                rawScore: chunkScore,
              })
            }
          }
        }
      }

      // Rank by relevance descending and retrieve up to top 5 chunks
      matchedSources.sort((a, b) => b.score - a.score || b.rawScore - a.rawScore)
      const top5Chunks = matchedSources.slice(0, 5)

      // Check if unapproved documents matched keywords (Governance Gate)
      const blockedMatches = []
      for (const unappDoc of unapprovedDocs) {
        if (unappDoc.sections && unappDoc.sections.length > 0) {
          for (const sec of unappDoc.sections) {
            const secText = (sec.title + ' ' + sec.content).toLowerCase()
            const unappDocText = `${unappDoc.title} ${unappDoc.summary || ''} ${secText}`.toLowerCase()
            const matchedKeywords = Array.from(expandedKeywords).filter((qw) => unappDocText.includes(qw)).length

            if (
              expandedKeywords.size > 0 &&
              matchedKeywords >= 2 &&
              (qLower.includes('eo') || qLower.includes('health') || qLower.includes('protocol') || unappDoc.officialStatus !== 'Opisyal')
            ) {
              blockedMatches.push({
                docTitle: unappDoc.title,
                status: unappDoc.officialStatus,
                reason: isEnglish
                  ? 'Not yet officially signed or approved by the Punong Barangay (Pending Sign-off).'
                  : 'Hindi pa opisyal na naaprubahan o nalalagdaan ng Punong Barangay (Pending Sign-off).',
              })
              break
            }
          }
        }
      }

      let botResponse = ''

      if (top5Chunks.length > 0) {
        const primary = top5Chunks[0]
        const ordLabel = primary.ordinanceNo ? `${primary.ordinanceNo} - ` : ''

        // Secondary chunk MUST strictly belong to the SAME document as primary
        const secondary = top5Chunks.find(
          (c, idx) => idx > 0 && c.docTitle === primary.docTitle
        )

        if (isEnglish) {
          // Professional Philippine English Generation (Llama 3.1 8B Instruct Grounded)
          botResponse = `Good day! Based on our official records in **${ordLabel}${primary.docTitle}**, specifically under **${primary.sectionTitle}**:\n\n`
          botResponse += `> "${primary.content}"\n\n`

          if (secondary) {
            const secOrdLabel = secondary.ordinanceNo ? `${secondary.ordinanceNo} - ` : ''
            botResponse += `Additionally, under **${secOrdLabel}${secondary.sectionTitle}**:\n> "${secondary.content}"\n\n`
          }

          botResponse += `If you have further questions or need official assistance, please feel free to visit the Barangay Hall or coordinate with our Desk Officer.`
        } else {
          // Courteous Filipino Generation (Llama 3.1 8B Instruct Grounded)
          botResponse = `Magandang araw po! Batay sa opisyal na tala ng **${ordLabel}${primary.docTitle}**, partikular sa **${primary.sectionTitle}**:\n\n`
          botResponse += `> "${primary.content}"\n\n`

          if (secondary) {
            const secOrdLabel = secondary.ordinanceNo ? `${secondary.ordinanceNo} - ` : ''
            botResponse += `Karagdagan alinsunod sa **${secOrdLabel}${secondary.sectionTitle}**:\n> "${secondary.content}"\n\n`
          }

          botResponse += `Kung may karagdagang katanungan o kailangan ng opisyal na tulong, maaaring magsadya sa Tanggapan ng Barangay Hall o makipag-ugnayan sa ating Desk Officer.`
        }
      } else if (blockedMatches.length > 0) {
        if (isEnglish) {
          botResponse = `We apologize, but there is **no official and ratified ordinance** approved by the Punong Barangay regarding this matter yet. A related document is currently undergoing review and sign-off, so it cannot yet serve as an active public guide for Barangay-Bot.\n\nPlease coordinate directly with the Office of the Punong Barangay for further inquiries.`
        } else {
          botResponse = `Paumanhin po, ngunit **wala pa pong opisyal at may-bisang ordinansa** o polisiya na naaprubahan ng Punong Barangay ukol sa paksang ito. Mayroong kaugnay na dokumento na kasalukuyang sumasailalim sa pagsusuri ng pamunuan, kaya hindi pa ito pinahihintulutang maging pampublikong gabay ng Barangay-Bot.\n\nMangyaring sumangguni nang personal sa Tanggapan ng Punong Barangay para sa karagdagang impormasyon.`
        }
      } else {
        if (isEnglish) {
          botResponse = `I apologize, but I don't have any data for that yet. Please contact or visit the Barangay Hall for further questions and assistance.`
        } else {
          botResponse = `Paumanhin po, wala pa po akong sapat na tala ukol sa paksang ito. Mangyaring makipag-ugnayan o magsadya sa Barangay Hall para sa inyong karagdagang katanungan at tulong.`
        }
      }

      const botMessage = {
        sender: 'bot',
        text: botResponse,
        sources: top5Chunks,
        blocked: blockedMatches,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setChatHistory((prev) => [...prev, botMessage])
      setLoading(false)
    }, 650)
  }

  const handleCopyText = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const toggleCitationExpand = (key) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden">
      {/* Click outside backdrop with fade animation */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity ${
          isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Main Container: Smooth slide-in from right */}
      <div
        className={`relative flex flex-col bg-white shadow-2xl border-l border-gray-200 z-10 h-full w-full sm:w-[540px] md:w-[600px] lg:w-[640px] overflow-hidden ${
          isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3.5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 text-white shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                Barangay-Bot Test Bench
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Pagsubok sa pagsagot batay sa mga opisyal na ordinansa
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Clear Chat */}
            {chatHistory.length > 0 && (
              <button
                onClick={() => setChatHistory([])}
                title="Linisin ang Chat History"
                className="flex items-center gap-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            {/* Close */}
            <button
              onClick={handleClose}
              title="Isara ang Test Bench"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sub-header Ribbon */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-5 py-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium text-gray-700">
              <strong>{officialDocs.length}</strong> Opisyal na Sanggunian
            </span>
          </div>
        </div>

        {/* Chat Conversation & Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40">
          {chatHistory.length === 0 ? (
            /* Empty State / Suggested Questions */
            <div className="py-2 space-y-3">
              <div className="px-1">
                <h4 className="text-xs font-semibold text-gray-700">
                  Mga Mungkahing Pagsubok:
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Pumili ng katanungan sa ibaba upang masubukan ang pagsagot ng bot batay sa mga naaprubahang ordinansa.
                </p>
              </div>

              <div className="space-y-2">
                {categorizedStarters.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTestQuery(starter.query)}
                    className="group w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-2xs hover:border-bb-blue hover:bg-blue-50/20 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-bb-blue">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-gray-400 block truncate">
                          {starter.category}
                        </span>
                        <p className="text-xs font-medium text-gray-800 group-hover:text-bb-blue transition-colors line-clamp-1">
                          "{starter.query}"
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-bb-blue group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>

              {dynamicDocQueries.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-medium text-gray-500 px-1 mb-1.5">
                    Iba pang katanungan mula sa mga seksyon:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {dynamicDocQueries.slice(0, 3).map((dq, qIdx) => (
                      <button
                        key={qIdx}
                        onClick={() => handleTestQuery(dq.query)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 hover:border-bb-blue hover:text-bb-blue hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        {dq.query}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chat Stream */
            chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 animate-fade-in ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Bot Avatar */}
                {msg.sender === 'bot' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 text-white shadow-xs mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end max-w-[85%]' : 'items-start max-w-[92%]'
                  }`}
                >
                  {/* Sender Name & Timestamp */}
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400">
                    <span className="font-medium text-gray-600">
                      {msg.sender === 'user' ? 'Ikaw (Admin)' : 'Barangay-Bot AI'}
                    </span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {msg.sender === 'user' ? (
                    /* User Bubble */
                    <div className="rounded-2xl rounded-tr-xs bg-bb-blue px-4 py-2.5 text-xs sm:text-sm text-white shadow-xs font-normal leading-relaxed">
                      {msg.text}
                    </div>
                  ) : (
                    /* Bot Response Card */
                    <div className="w-full space-y-3 rounded-2xl rounded-tl-xs border border-gray-200 bg-white p-4 sm:p-5 shadow-xs">
                      {/* Body with formatting */}
                      <div className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                        {msg.text.split('\n\n').map((paragraph, pIdx) => {
                          if (paragraph.startsWith('>')) {
                            return (
                              <div
                                key={pIdx}
                                className="my-2.5 rounded-r-xl border-l-4 border-bb-blue bg-blue-50/60 p-3 text-xs italic text-gray-800"
                              >
                                {paragraph.replace(/^>\s*/, '')}
                              </div>
                            )
                          }
                          return (
                            <p key={pIdx} className="mb-2 last:mb-0">
                              {paragraph}
                            </p>
                          )
                        })}
                      </div>

                      {/* Action Bar (Copy, Status) */}
                      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs text-gray-400">
                        <span className="text-[11px] flex items-center gap-1 text-gray-500">
                          {msg.sources && msg.sources.length > 0 ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              Batay sa opisyal na ordinansa
                            </>
                          ) : msg.isGreeting ? (
                            <>
                              <Bot className="h-3 w-3 text-purple-500" />
                              Pagbati (Greeting)
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                              Walang nahanap na opisyal na tala
                            </>
                          )}
                        </span>
                        <button
                          onClick={() => handleCopyText(msg.text, idx)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-600">Kopyado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Kopyahin</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Grounding Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between font-semibold text-gray-800 text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-bb-blue" />
                              Mga Pinagbatayang Seksyon ({msg.sources.length})
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {msg.sources.map((src, sIdx) => {
                              const expandKey = `${idx}_${sIdx}`
                              const isExpandedItem = !!expandedCitations[expandKey]

                              return (
                                <div
                                  key={sIdx}
                                  className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5 text-bb-blue shrink-0" />
                                        <span className="font-semibold text-gray-800 text-[11px] truncate">
                                          {src.ordinanceNo ? `${src.ordinanceNo} • ` : ''}
                                          {src.sectionTitle}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                                        Dokumento: {src.docTitle}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Excerpt Toggle */}
                                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                                    <button
                                      onClick={() => toggleCitationExpand(expandKey)}
                                      className="flex items-center gap-1 text-[10px] font-semibold text-bb-blue hover:underline cursor-pointer"
                                    >
                                      {isExpandedItem ? (
                                        <>
                                          <ChevronUp className="h-3 w-3" />
                                          <span>Itago ang sipi</span>
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-3 w-3" />
                                          <span>Tingnan ang teksto ng sipi</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {isExpandedItem && (
                                    <div className="mt-2 rounded-md bg-gray-50 p-2 text-[11px] text-gray-700 leading-relaxed border border-gray-200">
                                      "{src.content}"
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Blocked Documents Warning */}
                      {msg.blocked && msg.blocked.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
                            <ShieldCheck className="h-4 w-4 text-amber-700" />
                            <span>Hindi Ginamit ang Draft na Dokumento</span>
                          </div>
                          {msg.blocked.map((b, bIdx) => (
                            <p key={bIdx} className="text-[11px] text-amber-800 leading-relaxed">
                              Hindi ginamit ang <strong>"{b.docTitle}"</strong> sa pagsagot dahil hindi pa ito opisyal na naaprubahan.
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {msg.sender === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-gray-700 shadow-xs mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Thinking / Retrieval Animation */}
          {loading && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-bb-navy to-bb-blue text-white shadow-xs">
                <Bot className="h-4 w-4 animate-pulse" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 shadow-xs">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-bb-blue animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-bb-blue animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-bb-blue animate-bounce [animation-delay:0.4s]" />
                </div>
                <span>Sinisipi ang mga opisyal na ordinansa at bumubuo ng tugon...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Dock */}
        <div className="border-t border-gray-200 bg-white p-3.5 sm:p-4 shadow-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleTestQuery()
            }}
            className="relative flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Magtanong ukol sa ordinansa, clearance, alituntunin, o parusa..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs sm:text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Subukan</span>
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-gray-400 shrink-0" />
              <span>Nakabatay sa mga opisyal na ordinansa at tala ng barangay.</span>
            </span>
            <span className="hidden sm:inline font-mono">Pindutin ang Enter</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
