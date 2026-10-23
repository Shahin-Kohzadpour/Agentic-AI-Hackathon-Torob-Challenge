"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Headphones, MessageSquare, RotateCcw, Search, Send, ShieldCheck, Smartphone, Store, X } from "lucide-react";
import type { WorkflowSnapshot } from "@/lib/workflow";
import PreferencePanel from "./PreferencePanel";
import ShoppingCanvas from "./ShoppingCanvas";
import VoiceInput from "./VoiceInput";
import ImageInput from "./ImageInput";

export default function ChatInterface({demoMode=false}:{demoMode?:boolean}) {
 const [data,setData]=useState<WorkflowSnapshot|null>(null),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[conversationOpen,setConversationOpen]=useState(false),[entry,setEntry]=useState<"discover"|"direct">("discover");
 const sequence=useRef(0),controller=useRef<AbortController|null>(null),bottom=useRef<HTMLDivElement>(null),field=useRef<HTMLInputElement>(null);
 const resultStart=useRef<HTMLDivElement>(null);
 const focusStage=data?.session.stage;
 async function reload() {
  const response=await fetch("/api/workflow",{cache:"no-store"});
  const next=await response.json();if(!response.ok)throw new Error(next.error||"بارگذاری انجام نشد.");
  setData(next);return next as WorkflowSnapshot;
 }
 useEffect(()=>{reload().catch(e=>setError(e.message));return()=>controller.current?.abort()},[]);
 useEffect(()=>{if(conversationOpen)bottom.current?.scrollIntoView({block:"nearest",behavior:"smooth"})},[data?.session.messages.length,busy,conversationOpen]);
 useEffect(()=>{const viewport=window.visualViewport;const resize=()=>{document.documentElement.style.setProperty("--keyboard-inset",`${Math.max(0,window.innerHeight-(viewport?.height||window.innerHeight)-(viewport?.offsetTop||0))}px`)};resize();viewport?.addEventListener("resize",resize);viewport?.addEventListener("scroll",resize);return()=>{viewport?.removeEventListener("resize",resize);viewport?.removeEventListener("scroll",resize)}},[]);
 useEffect(()=>{if(!focusStage)return;setConversationOpen(false);const timer=setTimeout(()=>{if(focusStage==="discover")window.scrollTo({top:0,behavior:"smooth"});else resultStart.current?.querySelector(".canvas-content")?.scrollIntoView({block:"start",behavior:"smooth"})},100);return()=>clearTimeout(timer)},[focusStage,data?.session.selectedProductId,data?.session.query,data?.session.visitCheckId]);
 useEffect(()=>{
  if(data?.activeCheck?.status!=="CHECKING"||busy) return;
  const generation=sequence.current;
  const timer=setTimeout(async()=>{try {const response=await fetch("/api/workflow",{cache:"no-store"});const next=await response.json();if(response.ok&&sequence.current===generation)setData(next)}catch{setError("دریافت وضعیت بررسی انجام نشد؛ بارگذاری دوباره را بزنید.")}},850);
  return()=>clearTimeout(timer);
 },[data,busy]);
 async function act(action:string,body:Record<string,unknown>={}) {
  if(!data) return;
  const generation=++sequence.current;controller.current?.abort();controller.current=new AbortController();
  setBusy(true);setError("");
  try {
   const response=await fetch("/api/workflow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,version:data.session.version,...body}),signal:controller.current.signal});
   const next=await response.json();if(generation!==sequence.current)return;
   if(!response.ok){if(response.status===409)await reload();throw new Error(next.error||"درخواست انجام نشد؛ دوباره تلاش کنید.")}
   setData(next);if(action==="reset"){setInput("");setConversationOpen(false)}
  } catch(e) {if(generation===sequence.current&&!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"خطای ارتباط؛ دوباره تلاش کنید.")}
  finally {if(generation===sequence.current)setBusy(false)}
 }
 function send(text:string) {if(!text.trim()||busy)return;setInput("");act("chat",{message:text.trim()});}
 const stage=data?.session.stage||"discover";
 const lastAnswer=data?.session.messages.filter(message=>message.role==="assistant").at(-1)?.text;
 const steps=[{label:"انتخاب مدل",done:["stores","checking","visit"].includes(stage),active:["discover","products","empty"].includes(stage)},{label:"بررسی فروشگاه",done:stage==="visit",active:["stores","checking"].includes(stage)},{label:"برنامهٔ مراجعه",done:false,active:stage==="visit"}];
 return <div className="app-shell">
  <header className="app-header"><a className="brand" href="/" aria-label="دستیار خرید حضوری ترب"><span className="brand-symbol">ترب</span><div><strong>کاوشگران</strong><span>همراه خرید حضوری ترب</span></div></a><div className="header-actions"><span className="data-tag"><Store size={15}/>تهران</span><button className="icon-button" onClick={()=>act("reset")} title="شروع دوباره" aria-label="شروع دوباره"><RotateCcw size={18}/></button></div></header>
  <div className="step-strip" aria-label="مراحل خرید">{steps.map((step,index)=><div className={step.active?"step active":step.done?"step done":"step"} key={step.label}><span>{step.done?<ShieldCheck size={16}/>:String(index+1).replace(/\d/g,c=>"۰۱۲۳۴۵۶۷۸۹"[Number(c)])}</span><strong>{step.label}</strong>{index<2&&<ArrowLeft size={14}/>}</div>)}</div>
  <main className="workspace">
   <aside className="conversation-panel"><div className="conversation-heading"><div><MessageSquare size={18}/><h1>با هم انتخاب کنیم</h1></div><button className="mobile-conversation-toggle icon-button" aria-expanded={conversationOpen} aria-label="نمایش مکالمه" onClick={()=>setConversationOpen(!conversationOpen)}><ChevronDown size={18}/></button></div>
    {!conversationOpen&&(busy||lastAnswer)&&<div className="mobile-latest-message" role="status">{busy?<p className="mobile-working"><span className="loading-dots"/>در حال بررسی نیاز و کاتالوگ…</p>:<><p>{lastAnswer!.length>200?lastAnswer!.slice(0,200)+"…":lastAnswer}</p>{lastAnswer!.length>200&&<button className="text-button" onClick={()=>setConversationOpen(true)}>ادامهٔ توضیح و مکالمه</button>}</>}</div>}
    <div className={`conversation-scroll ${conversationOpen?"expanded":""}`}>
     {!data?.session.messages.length&&<div className="welcome"><p>سلام! نام مدل را می‌دانید یا برای انتخاب کمک می‌خواهید؟</p><div className="entry-options"><button className={entry==="discover"?"selected":""} onClick={()=>{setEntry("discover");field.current?.focus()}}><Headphones size={21}/><strong>کمکم کن انتخاب کنم</strong><span>با نیاز و بودجه شروع کنیم</span></button><button className={entry==="direct"?"selected":""} onClick={()=>{setEntry("direct");field.current?.focus()}}><Search size={21}/><strong>مدلم را می‌دانم</strong><span>نام یا کد دقیق مدل را بنویسید</span></button></div><p className="muted">{entry==="direct"?"کد مدل، ظرفیت یا رنگ را هم بنویسید تا گزینهٔ متفاوت پیشنهاد نشود.":"برای چه کاری خرید می‌کنید و سقف بودجه‌تان چند تومان است؟"}</p><div className="suggestion-chips"><button disabled={busy} onClick={()=>send("هندزفری برای رفت‌وآمد با بودجه ۴٫۲ میلیون تومان و ترب‌پی حضوری می‌خواهم")}><Headphones size={14}/>هندزفری برای رفت‌وآمد</button><button disabled={busy} onClick={()=>send("گوشی برای عکاسی می‌خواهم؛ کمکم کن انتخاب کنم")}><Smartphone size={14}/>گوشی برای عکاسی</button></div></div>}
     {data?.session.messages.map(message=><div className={`message ${message.role}`} key={message.id}><span className="message-author">{message.role==="user"?"شما":"همراه خرید"}</span><p>{message.text}</p></div>)}
     {busy&&<div className="working" role="status"><span className="loading-dots"/>در حال بررسی شرایط و کاتالوگ…</div>}<div ref={bottom}/>
    </div>
    <div className="composer-area">{error&&<div className="error-banner" role="alert"><p>{error}</p><button aria-label="بستن پیام خطا" onClick={()=>setError("")}><X size={16}/></button><button className="text-button" onClick={()=>reload().catch(e=>setError(e.message))}>بارگذاری دوباره</button></div>}
     <form className="composer" onSubmit={e=>{e.preventDefault();if(document.activeElement?.closest(".media-popover"))return;send(input)}}><div className="composer-tools"><VoiceInput contextKey={`${data?.session.id}:${data?.session.version}`} onTranscriptReady={send} disabled={busy||!data}/><ImageInput contextKey={`${data?.session.id}:${data?.session.version}`} onImageModelRecognized={query=>{setInput(query);field.current?.focus()}} disabled={busy||!data}/></div><label className="sr-only" htmlFor="shopping-message">نیاز یا مدل مورد نظر</label><input id="shopping-message" ref={field} value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} placeholder={entry==="direct"?"نام یا کد مدل":"نیاز یا مدل مورد نظر"}/><button className="send-button" disabled={!input.trim()||busy||!data} aria-label="ارسال پیام"><Send size={18}/></button></form>
     <p className="composer-disclosure">پیگیری فروشنده شبیه‌سازی است؛ متن صوت و تصویر قابل بررسی است.</p>
    </div>
   </aside>
   <div className="results-panel" ref={resultStart}>{data?<><PreferencePanel preferences={data.session.preferences} busy={busy} onApply={preferences=>act("preferences",{preferences})}/>{demoMode&&<div className="demo-controls"><label>سناریوی شبیه‌سازی فروشنده<select value={data.session.scenario} onChange={e=>act("scenario",{scenario:e.target.value})}>{[["AUTO","خودکار؛ شکست فروشندهٔ اول دمو"],["AVAILABLE","موجود اعلام شود"],["NO_ANSWER","پاسخ ندهد"],["OUT_OF_STOCK","ناموجود اعلام شود"],["PRICE_CHANGED","قیمت ۱۰٪ افزایش یابد"],["CLOSING","زمان مراجعه نامناسب"],["AMBIGUOUS_VARIANT","واریانت مبهم"]].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><button className="text-button" onClick={()=>send("Anker Soundcore R50i A3949 با بودجه ۴٫۲ میلیون تومان و ترب‌پی حضوری در جمهوری")}>اجرای نمونهٔ R50i</button></div>}<ShoppingCanvas data={data} busy={busy} act={act}/></>:<div className="initial-loading" role="status">{error||"در حال بارگذاری جلسهٔ خرید…"}</div>}</div>
  </main>
 </div>;
}
