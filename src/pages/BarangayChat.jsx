import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronRight, Sparkles, SquarePen, BookOpen } from 'lucide-react'
import { documentRequest } from '../lib/documentAdmin'
import { chunkParagraphs } from '../lib/chunkDisplay'
import { relatedTopicReply } from '../lib/relatedTopics'
import BotOverview from '../components/BotOverview'
import './BarangayChat.css'

function InlineText({text}) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part,index)=>part.startsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part)
}
function Reply({message}) {
  const text=message.sources?.length?message.text.split(/\n(?:Sources|Pinagmulan):\s*\n/)[0]:message.text
  return <><div className="bb-reply-text">{text.split(/\n\s*\n/).filter(Boolean).map((block,index)=><p key={index}><InlineText text={block.replace(/^#{1,4}\s+/gm,'')}/></p>)}</div>{message.sources?.length>0&&<div className="bb-source-list"><span><BookOpen size={13}/>Mga sanggunian</span>{message.sources.map((source,index)=><details key={index}><summary><span className="bb-source-number">{source.id||index+1}</span><strong>{source.filename}</strong>{source.page&&<small>Page {source.page}</small>}<ChevronRight size={14}/></summary><div>{chunkParagraphs(source.excerpt).map((paragraph,part)=><p key={part}>{paragraph}</p>)}</div></details>)}</div>}</>
}
export default function BarangayChat({active=true}) {
  const session=useRef(crypto.randomUUID())
  const messagesRef=useRef(null)
  const busy=useRef(false)
  const initialized=useRef(false)
  const [overviewRevision,setOverviewRevision]=useState(0)
  const [menu,setMenu]=useState(null)
  const [messages,setMessages]=useState([])
  const [input,setInput]=useState('')
  const [sending,setSending]=useState(false)
  const [error,setError]=useState('')
  const [menuError,setMenuError]=useState('')
  async function loadMenu(){setMenuError('');try{setMenu(await documentRequest('/chatbot/menu'))}catch(failure){setMenuError(failure.message)}}
  useEffect(()=>{if(active&&!initialized.current){initialized.current=true;loadMenu()}},[active])
  useEffect(()=>{const box=messagesRef.current;if(active&&box){if(messages.length)box.scrollTo({top:box.scrollHeight,behavior:'smooth'});else box.scrollTop=0}},[messages,sending,active])
  async function ask(question,retry=false){
    if(busy.current)return
    busy.current=true;setSending(true);setError('')
    if(!retry)setMessages(previous=>[...previous,{role:'user',text:question}])
    try{const result=await documentRequest('/chatbot/message',{question,session_id:session.current});const reply=relatedTopicReply(result.answer);setMessages(previous=>[...previous,{role:'assistant',text:reply.text,sources:result.sources||[],suggestions:[...new Set([...reply.topics,...(result.suggestions||[])])],related:reply.topics.length>0,failed:result.status==='service_failure'}])}
    catch(failure){setError(failure.message)}
    finally{busy.current=false;setSending(false);setOverviewRevision(value=>value+1)}
  }
  function newChat(){if(busy.current)return;session.current=crypto.randomUUID();setMessages([]);setInput('');setError('')}
  function submit(event){event.preventDefault();if(!input.trim()||busy.current)return;const question=input.trim();setInput('');ask(question)}
  return <div className="bb-admin-layout"><section className="barangay-chat bb-app-chat">
    <header><h2>Barangay Bot</h2><button type="button" className="bb-new-chat" onClick={newChat} disabled={sending||!messages.length}><SquarePen size={22}/><span>Bagong Chat</span></button></header>
    <div ref={messagesRef} className="barangay-chat-messages" aria-live="polite">
      {!messages.length&&<div className="bb-welcome"><div className="bb-welcome-avatar"><Sparkles size={25}/></div>{menu?<><h3>{menu.greeting}</h3><p>{menu.closing}</p><div className="bb-category-heading"><span>Mga kategorya</span><small>{menu.categories.length} na paksa</small></div><div className="bb-categories">{menu.categories.map((category,index)=><button key={category.id} type="button" onClick={()=>ask(category.label)} disabled={sending}><span className="bb-category-number">{index+1}</span><span className="bb-category-label"><strong>{category.label}</strong><small>{category.example}</small></span><ChevronRight size={16}/></button>)}</div></>:menuError?<div className="barangay-chat-error" role="alert"><p>{menuError}</p><button type="button" onClick={loadMenu}>Subukan muli</button></div>:<p role="status">Inihahanda ang mga paksa…</p>}</div>}
      {messages.length>0&&<div className="bb-conversation">{messages.map((message,index)=>message.role==='user'?<article className="bb-user-message" key={index}><p>{message.text}</p></article>:<article className="bb-bot-message" key={index}><span className="bb-bot-avatar" aria-label="Barangay Bot"><Sparkles size={16}/></span><div className="bb-bot-content"><Reply message={message}/>{index===messages.length-1&&message.suggestions?.length>0&&<div className="bb-suggestions"><span>{message.related?'Mga kaugnay na tanong':'Pumili ng paksa'}</span>{message.suggestions.map(text=><button type="button" key={text} disabled={sending} onClick={()=>ask(text)}>{text}<ChevronRight size={15}/></button>)}</div>}</div></article>)}{sending&&<div className="bb-bot-message"><span className="bb-bot-avatar"><Sparkles size={16}/></span><div className="bb-thinking" role="status"><span className="bb-typing-dots" aria-hidden="true"><i/><i/><i/></span><small>Hinahanap sa mga dokumento…</small></div></div>}</div>}
      {error&&<div className="barangay-chat-error" role="alert"><p>{error}</p><button type="button" onClick={()=>{const last=[...messages].reverse().find(message=>message.role==='user');if(last)ask(last.text,true)}}>Subukan muli</button></div>}
    </div>
    <div className="bb-composer-area"><form onSubmit={submit}><textarea aria-label="Tanong para sa Barangay Bot" placeholder="Pumili ng numero o magtanong…" value={input} onChange={event=>setInput(event.target.value)} maxLength={4000} rows={1} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter')submit(event)}}/><button aria-label="Ipadala ang tanong" disabled={sending||!input.trim()}><ArrowUp size={20}/></button></form><p>Maaaring magkamali ang Barangay-Bot. Para sa opisyal na detalye, bisitahin o tawagan ang barangay hall.</p></div>
  </section><BotOverview active={active} revision={overviewRevision} onAsk={ask} disabled={sending}/></div>
}
