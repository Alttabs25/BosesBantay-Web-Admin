import { useLayoutEffect, useRef, useState } from 'react'
import { CalendarCheck2, CalendarClock, FileText, ShieldAlert } from 'lucide-react'
import Pill from './Pill'
import { STATUS_META, OUTCOME_OPTIONS } from '../data/mockBlotter'

const QUESTION_SECTIONS = [
  {
    title: 'Salaysay at pangyayari',
    description: 'Orihinal na salaysay at mga detalye ng insidente',
    questions: [
      ['description', 'Pakisabi po nang detalyado kung ano ang nangyari.'],
      ['incidentAt', 'Kailan po at anong oras nangyari ang insidente?'],
      ['location', 'Saan po eksakto nangyari ang insidente?'],
      ['respondentName', 'Sino po ang inyong sinusumbong, kung kilala ninyo?'],
      ['witnesses', 'May mga saksi po ba sa insidente? Kung meron, sino po sila?'],
      ['evidence', 'May larawan, video, o iba pang ebidensya po ba kayong madadala?'],
    ],
  },
  {
    title: 'Impormasyon ng naghahain',
    description: 'Mga sagot tungkol sa residente at tagapag-ulat',
    questions: [
      ['complainantName', 'Sabihin po ninyo ang inyong buong pangalan.'],
      ['complainantAddress', 'Ano po ang inyong kumpletong tirahan o purok?'],
      ['complainantAge', 'Ilang taon po kayo?'],
      ['complainantContact', 'Ano po ang inyong numero ng contact?'],
      ['complainantGender', 'Ano po ang inyong kasarian?'],
    ],
  },
  {
    title: 'Uri at hinihiling na aksyon',
    description: 'Uri ng blotter at mga hiniling na susunod na hakbang',
    questions: [
      ['filedByGuardian', 'Kayo mismo ba ang nagsasampa, o bilang magulang o tagapag-alaga?'],
      ['guardianName', 'Ano po ang pangalan ng magulang o tagapag-alagang naghahain?'],
      ['blotterType', 'Ano po ang uri ng blotter na gusto ninyong ihain?'],
      ['incidentCategory', 'Anong kategorya po ang pinakabagay sa insidenteng ito?'],
      ['requestCctv', 'Gusto niyo po bang humiling ng CCTV review?'],
    ],
  },
]

const LEGACY_QUESTIONS = [
  ['what', 'Ano ang nangyari?'],
  ['who', 'Sino ang sangkot?'],
  ['where', 'Saan nangyari?'],
  ['when', 'Kailan nangyari?'],
  ['why', 'Bakit nangyari?'],
  ['how', 'Paano nangyari?'],
]

const REVIEW_LABELS = {
  description: 'Salaysay ng insidente', incidentAt: 'Petsa at oras ng insidente', location: 'Lugar ng insidente', respondentName: 'Inirereklamo', witnesses: 'Mga saksi', evidence: 'Nabanggit na ebidensya',
  complainantName: 'Buong pangalan', complainantAddress: 'Tirahan / purok', complainantAge: 'Edad', complainantContact: 'Contact number', complainantGender: 'Kasarian',
  filedByGuardian: 'Paraan ng paghahain', guardianName: 'Magulang / tagapag-alaga', blotterType: 'Uri ng blotter', incidentCategory: 'Kategorya ng insidente', requestCctv: 'Kahilingan sa CCTV review',
}

function readable(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Oo' : 'Hindi'
  return ''
}

function legacyEntries(value, prefix = '') {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, item]) => {
    const label = `${prefix}${key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}`
    if (item && typeof item === 'object' && !Array.isArray(item)) return legacyEntries(item, `${label} · `)
    const text = Array.isArray(item) ? item.map((entry) => readable(entry) || (entry && typeof entry === 'object' ? JSON.stringify(entry) : '')).filter(Boolean).join(', ') : readable(item)
    return text ? [[label, text]] : []
  })
}

function answerFor(report, key) {
  const details = report.intakeDetails || {}
  if (key === 'description') return readable(details.description) || readable(details.raw_narrative) || readable(report.excerpt)
  if (key === 'requestCctv') return readable(details.requestCctv) || (details.request_cctv_review === true ? 'Oo' : details.request_cctv_review === false ? 'Hindi' : '')
  if (key === 'filedByGuardian') return readable(details.filedByGuardian) || (details.filed_by_guardian === true ? 'Bilang magulang/tagapag-alaga' : details.filed_by_guardian === false ? 'Ako mismo' : '')
  return readable(details[key])
}

function PaperSectionHeading({ number, children }) {
  return <div className="paper-section-heading">{number && <span className="paper-section-number">{String(number).padStart(2, '0')}</span>}<h4>{children}</h4></div>
}

function NarrativePaper({ report }) {
  const details = report.intakeDetails || {}
  const narrative = readable(details.description) || readable(details.raw_narrative) || readable(report.excerpt)
  const mainQuestions = { kailanSaan: 'Kailan at saan po eksakto nangyari ang insidente?', sino: 'Sino po ang mga sangkot sa insidenteng ito?' }
  const supplements = Array.isArray(details.raw_transcripts) ? details.raw_transcripts.filter(entry => mainQuestions[entry.chunk] && readable(entry.text) && readable(entry.text) !== narrative) : []
  return <section className="paper-section px-6 py-6 sm:px-10" aria-label="Salaysay ng residente">
    <PaperSectionHeading number={2}>Salaysay ng residente</PaperSectionHeading>
    <dl className="paper-narrative-fields">
      {[{ question: 'Ikwento niyo po nang detalyado ang buong pangyayari.', text: narrative }, ...supplements.map(entry => ({ question: mainQuestions[entry.chunk], text: entry.text }))].map((entry, index) => <div key={index} className="paper-answer-block"><dt className="paper-question">{entry.question}</dt><dd className={`paper-narrative whitespace-pre-wrap break-words ${entry.text ? '' : 'paper-empty'}`}>{entry.text || 'Walang nakatalang sagot.'}</dd></div>)}
    </dl>
  </section>
}

function QuestionSection({ title, questions, report, isMobileIntake, number, documentStyle = true }) {
  const visibleQuestions = isMobileIntake ? questions : questions.filter(([key]) => readable(report[key]))
  if (!visibleQuestions.length) return null
  return (
    <section className={documentStyle ? 'paper-section px-6 py-6 sm:px-10' : 'border-t border-slate-200 px-5 py-6 sm:px-6'} aria-label={title}>
      {documentStyle ? <PaperSectionHeading number={number}>{title}</PaperSectionHeading> : <div className="flex items-center gap-3">{number && <span className="text-[11px] font-semibold tabular-nums text-slate-400">{String(number).padStart(2, '0')}</span>}<h4 className="text-sm font-bold text-slate-900">{title}</h4></div>}

      <dl className={documentStyle ? 'paper-field-grid' : 'mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2'}>
        {visibleQuestions.map(([key, question]) => {
          const answer = isMobileIntake ? answerFor(report, key) : readable(report[key])
          let displayAnswer = answer || (key === 'guardianName' && answerFor(report, 'filedByGuardian') === 'Ako mismo' ? 'Hindi naaangkop' : 'Walang nakatalang sagot')
          if (!documentStyle && key === 'incidentAt' && /^\d{4}-\d{2}-\d{2}T/.test(answer) && Number.isFinite(Date.parse(answer))) displayAnswer = new Date(answer).toLocaleString('fil-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' })
          return <div key={key} className={`min-w-0 break-inside-avoid ${['description', 'location', 'complainantAddress', 'evidence', 'filedByGuardian', 'guardianName'].includes(key) ? 'sm:col-span-2' : ''}`}>
            <dt className="text-xs font-medium leading-relaxed text-gray-500">{documentStyle ? question : REVIEW_LABELS[key] || question}</dt>
            <dd className={`${documentStyle ? 'mt-1 border-b border-gray-200 pb-2' : key === 'description' ? 'mt-2 border-b border-l-2 border-slate-200 pb-3 pl-4' : 'mt-1.5 border-b border-slate-200 pb-3'} whitespace-pre-wrap break-words text-sm leading-7 ${answer ? 'text-gray-900' : 'italic text-gray-400'}`}>{displayAnswer}</dd>
          </div>
        })}
      </dl>
    </section>
  )
}

export default function BlotterWorkspace({
  reports, selectedReport, onSelect, detailOnly = false, readOnly = false, canConfirm, canManageInvestigation,
  hearingDraft, setHearingDraft, outcomeDraft, setOutcomeDraft,
  onConfirm, onFlagSpam, onScheduleHearing, onMarkHearingHeld, onFinalize,
}) {
  const [paperZoom, setPaperZoom] = useState(100)
  const [showPaper, setShowPaper] = useState(false)
  const workspaceRef = useRef(null)
  useLayoutEffect(() => {
    const resize = () => {
      const element = workspaceRef.current
      if (element) element.style.setProperty('--blotter-detail-height', `${Math.max(280, window.innerHeight - element.getBoundingClientRect().top - 24)}px`)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  })
  return (
    <div ref={workspaceRef} className={readOnly ? 'case-original-view' : detailOnly ? 'blotter-detail-columns mt-4 min-w-0 pb-8' : 'mt-4 grid min-w-0 gap-4 pb-8 lg:h-[min(76vh,880px)] lg:grid-cols-[minmax(0,0.62fr)_minmax(260px,0.38fr)]'}>
      {!detailOnly && <section className="order-1 flex min-h-[220px] min-w-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm lg:order-2 lg:min-h-0" aria-label="Listahan ng blotter reports">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
          <h3 className="text-sm font-bold text-gray-900">Mga blotter</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-600">{reports.length}</span>
        </div>
        <div className="max-h-[340px] space-y-2 overflow-y-auto p-3 lg:max-h-none lg:min-h-0 lg:flex-1" role="listbox" aria-label="Pumili ng blotter report">
          {reports.map((report) => {
            const selected = selectedReport?.id === report.id
            const meta = STATUS_META[report.status] || { color: 'gray' }
            return <button key={`${report.sourceTable}:${report.dbId || report.id}`} id={`report-${String(report.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`} type="button" role="option" aria-selected={selected} onClick={() => onSelect(report)} className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-bb-blue ${selected ? 'border-bb-blue bg-blue-50 ring-1 ring-bb-blue/20' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
              <span className="block truncate text-[11px] font-bold tabular-nums text-bb-blue">{report.id}</span>
              <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{report.title || 'Blotter report'}</span>
              <span className="mt-1.5 block truncate text-xs text-gray-500">{report.location && report.location !== 'N/A' ? report.location : report.filedBy || 'Walang lokasyon'}</span>
              <span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500"><span>{report.datetime || 'Walang petsa'}</span><Pill color={meta.color} solid>{report.status}</Pill></span>
            </button>
          })}
          {reports.length === 0 && <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">Walang tugmang blotter report.</p>}
        </div>
      </section>}

      <section className={`min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100/80 p-2 shadow-sm sm:p-3 ${detailOnly ? 'min-h-[calc(100vh-14rem)]' : 'order-2 lg:order-1 lg:min-h-0 lg:overflow-y-auto'}`} aria-label="Detalye ng blotter report">
        {!selectedReport ? <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center text-gray-500">
          <FileText size={28} className="text-blue-300" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-bold text-gray-800">Pumili ng blotter report</h3>
          <p className="mt-1 max-w-xs text-xs leading-relaxed">I-click ang ulat sa listahan para makita ang buong salaysay, mga sagot, at status ng kaso.</p>
        </div> : <><div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div className="min-w-0"><h2 className="break-words font-mono text-sm font-semibold text-bb-blue">{selectedReport.id}</h2><p className="mt-1 text-xs text-slate-500">{selectedReport.datetime || 'Walang petsa'}</p></div>
          <div className="inline-flex shrink-0 gap-0.5 rounded-lg bg-slate-100 p-1" aria-label="Paraan ng pagtingin">{[[false, 'Kumpletong detalye'], [true, 'Tingnan ang papel']].map(([value, label]) => <button type="button" key={label} aria-pressed={showPaper === value} onClick={() => setShowPaper(value)} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${showPaper === value ? 'bg-white text-bb-blue shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>)}</div>
        </div>
        <div className="blotter-detail-body min-h-0 flex-1 overflow-y-auto overscroll-contain">{!showPaper ? <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="bg-slate-50/50 px-5 py-5 sm:px-6"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buod ng record</h3><dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">{[
            ['Naghain', selectedReport.intakeDetails?.complainantName || selectedReport.filedBy],
            ['Kategorya', selectedReport.intakeDetails?.incidentCategory || selectedReport.classification || selectedReport.title],
            ['Kasalukuyang status', selectedReport.status === 'Nareselba' ? (/CFA|certificate/i.test(selectedReport.outcome || '') ? 'Resolved · May CFA' : /settlement|settled|kasunduan|nagkaareglo/i.test(selectedReport.outcome || '') ? 'Resolved · Nagkaareglo' : 'Resolved') : selectedReport.status === 'Sinuri' ? 'Under Review' : selectedReport.status === 'Inimbestigahan' ? 'Investigating' : selectedReport.status],
            ['Pinagmulan', selectedReport.isFormReport ? 'Resident mobile intake' : 'Naunang blotter record'],
          ].map(([label, value]) => <div key={label}><dt className="text-[11px] font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium leading-relaxed text-slate-800">{value || 'Hindi nakatala'}</dd></div>)}</dl></div>
          {selectedReport.isFormReport && selectedReport.intakeDetails ? QUESTION_SECTIONS.map((section, index) => <QuestionSection key={section.title} {...section} number={index + 1} report={selectedReport} isMobileIntake documentStyle={showPaper} />) : <div className="p-5"><h3 className="text-sm font-bold text-gray-900">Salaysay at detalye</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-800">{selectedReport.excerpt || 'Walang salaysay.'}</p><dl className="mt-4 space-y-4">{[...LEGACY_QUESTIONS.map(([key, label]) => [label, readable(selectedReport[key])]), ...legacyEntries(selectedReport.legacyDetails)].filter(([, value]) => value).map(([label, value], index) => <div key={index}><dt className="text-xs font-semibold text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{value}</dd></div>)}</dl></div>}
          {selectedReport.intakeDetails?.raw_transcripts?.length > 0 && <details className="border-t border-gray-100 p-5"><summary className="cursor-pointer text-sm font-semibold text-gray-700">Orihinal na transcript</summary>{selectedReport.intakeDetails.raw_transcripts.map((entry, index) => <p key={index} className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{entry.text}</p>)}</details>}

        </div> : <><div className="blotter-paper-toolbar mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2" aria-label="Mga kontrol ng dokumento">
          <span className="text-xs font-semibold text-gray-600">Dokumento</span>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" aria-label="Zoom out" disabled={paperZoom <= 60} onClick={() => setPaperZoom((value) => Math.max(60, value - 10))} className="rounded px-3 py-1 text-sm font-bold hover:bg-gray-100 disabled:opacity-30">−</button>
            <select aria-label="Antas ng zoom" value={paperZoom} onChange={(event) => setPaperZoom(Number(event.target.value))} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs">{Array.from({ length: 15 }, (_, index) => 60 + index * 10).map((value) => <option key={value} value={value}>{value}%</option>)}</select>
            <button type="button" aria-label="Zoom in" disabled={paperZoom >= 200} onClick={() => setPaperZoom((value) => Math.min(200, value + 10))} className="rounded px-3 py-1 text-sm font-bold hover:bg-gray-100 disabled:opacity-30">+</button>
            <button type="button" onClick={() => setPaperZoom(100)} className="rounded px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">I-fit / Reset</button>
            <button type="button" onClick={() => window.print()} className="rounded bg-blue-50 px-3 py-1.5 text-xs font-semibold text-bb-blue hover:bg-blue-100">I-print / PDF</button>
          </div>
        </div><div className="overflow-auto p-1"><article style={{ zoom: paperZoom / 100 }} data-blotter-paper className={`mx-auto min-h-full w-full max-w-[850px] bg-white pb-4 shadow-sm ring-1 ring-gray-200 ${detailOnly ? 'min-h-[calc(100vh-16rem)]' : ''}`}>
          <div className="paper-letterhead px-6 pb-6 pt-8 sm:px-10 sm:pt-10">
            <p className="paper-brand">Boses Bantay</p>
            <h2 className="paper-title">Blotter Report</h2>
          </div>
          <div className="paper-reference mx-6 border-b border-gray-300 pb-5 sm:mx-10">
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reference no.</dt><dd className="mt-1 break-words font-semibold tabular-nums text-gray-900">{selectedReport.id}</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Petsa ng pagsusumite</dt><dd className="mt-1 text-gray-900">{selectedReport.datetime || 'Hindi nakatala'}</dd></div>
            </dl>

          </div>

          {selectedReport.isFormReport && selectedReport.intakeDetails ? <>
            <QuestionSection title="Impormasyon ng naghahain" number={1} questions={[...QUESTION_SECTIONS[1].questions, ...QUESTION_SECTIONS[2].questions.filter(([key]) => key === 'filedByGuardian' || (key === 'guardianName' && readable(selectedReport.intakeDetails.guardianName)))].map(([key, question]) => [key, REVIEW_LABELS[key] || question])} report={selectedReport} isMobileIntake documentStyle />
            <NarrativePaper report={selectedReport} />
            <QuestionSection number={3} title="Huling detalye" questions={QUESTION_SECTIONS[2].questions.filter(([key]) => ['blotterType', 'incidentCategory', 'requestCctv'].includes(key)).map(([key, question]) => [key, REVIEW_LABELS[key] || question])} report={selectedReport} isMobileIntake documentStyle />
          </> : <>
            {selectedReport.excerpt && <section className="px-6 py-5 sm:px-10"><h4 className="border-b border-gray-300 pb-2 font-serif text-base font-bold text-gray-900">Salaysay / buod</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-800">{selectedReport.excerpt}</p></section>}
            <QuestionSection title="Mga detalye ng insidente" questions={LEGACY_QUESTIONS} report={selectedReport} />
            {legacyEntries(selectedReport.legacyDetails).length > 0 && <section className="px-6 py-5 sm:px-10"><h4 className="border-b border-gray-300 pb-2 font-serif text-base font-bold text-gray-900">Iba pang nakatalang detalye</h4><dl className="mt-3 space-y-4">{legacyEntries(selectedReport.legacyDetails).map(([label, value], index) => <div key={`${label}-${index}`}><dt className="text-xs font-semibold capitalize text-gray-600">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words border-b border-gray-200 pb-2 text-sm leading-7 text-gray-900">{value}</dd></div>)}</dl></section>}
          </>}


        </article></div></>}</div>

        </>}
      </section>

    </div>
  )
}
