"use client";
import {useEffect,useRef,useState} from "react";
import {MapPin,RotateCcw,Send,X,ChevronDown,Navigation} from "lucide-react";
import type {WorkflowSnapshot} from "@/lib/workflow";
import PreferencePanel from "./PreferencePanel";
import ShoppingCanvas from "./ShoppingCanvas";
import VoiceInput from "./VoiceInput";
import ImageInput from "./ImageInput";
import LocationPicker from "./LocationPicker";
import {customerText} from "@/lib/customer-copy";

export default function ChatInterface() {
 const [choosingLocation,setChoosingLocation]=useState(false),[data,setData]=useState<WorkflowSnapshot|null>(null),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[conversationOpen,setConversationOpen]=useState(false);
 const sequence=useRef(0),controller=useRef<AbortController|null>(null),field=useRef<HTMLInputElement>(null),answer=useRef<HTMLDivElement>(null);
 async function reload(){const response=await fetch("/api/workflow",{cache:"no-store"});const next=await response.json();if(!response.ok)throw new Error(next.error||"بارگذاری انجام نشد.");setData(next);return next as WorkflowSnapshot;}
 useEffect(()=>{reload().catch(e=>setError(e.message));return()=>controller.current?.abort()},[]);
 useEffect(()=>{const viewport=window.visualViewport;const resize=()=>document.documentElement.style.setProperty("--keyboard-inset",`${Math.max(0,window.innerHeight-(viewport?.height||window.innerHeight)-(viewport?.offsetTop||0))}px`);resize();viewport?.addEventListener("resize",resize);viewport?.addEventListener("scroll",resize);return()=>{viewport?.removeEventListener("resize",resize);viewport?.removeEventListener("scroll",resize)}},[]);
 useEffect(()=>{
   if(data?.activeCheck?.status!=="CHECKING"||busy)return;
   const generation=sequence.current;
   const timer=setTimeout(async()=>{try{const response=await fetch("/api/workflow",{cache:"no-store"});const next=await response.json();if(response.ok&&sequence.current===generation)setData(next)}catch{setError("دریافت وضعیت انجام نشد؛ دوباره بارگذاری کنید.")}},850);
   return()=>clearTimeout(timer);
 },[data,busy]);
 async function act(action:string,body:Record<string,unknown>={}){
   if(!data||busy)return;
   const generation=++sequence.current;controller.current?.abort();controller.current=new AbortController();setBusy(true);setError("");
   try{
     const response=await fetch("/api/workflow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,version:data.session.version,...body}),signal:controller.current.signal});
     const next=await response.json();if(generation!==sequence.current)return;
     if(!response.ok){if(response.status===409)await reload();throw new Error(next.error||"درخواست انجام نشد؛ دوباره تلاش کنید.")}
     setData(next);if(action==="reset"){setInput("");setConversationOpen(false);window.scrollTo({top:0})}
     if(action==="chat")setTimeout(()=>answer.current?.scrollIntoView({block:"start",behavior:"smooth"}),70);
     return true;
   }catch(e){if(generation===sequence.current&&!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"خطای ارتباط؛ دوباره تلاش کنید.")}
   finally{if(generation===sequence.current)setBusy(false)}
 }
 function send(text:string){if(!text.trim()||busy)return;const message=text.trim();setInput("");act("chat",{message}).then(ok=>{if(!ok)setInput(message)})}
 const messages=data?.session.messages||[],lastUser=messages.filter(m=>m.role==="user").at(-1),lastAnswer=messages.filter(m=>m.role==="assistant").at(-1);
 const header=<header className="app-header minimal-header"><a className="minimal-brand" href="/" aria-label="کاوشگران، همراه خرید حضوری"><span className="brand-dot"/>کاوشگران</a><div className="header-actions"><button className="origin-button" aria-label="تغییر موقعیت" onClick={()=>setChoosingLocation(true)}><MapPin size={17}/><span>{data?.session.preferences.locationConfirmed?data.session.preferences.location.label:"تهران"}</span></button>{data?.session.preferences.locationConfirmed&&<button className="icon-button" disabled={busy} aria-label="شروع دوباره" onClick={()=>act("reset")}><RotateCcw size={18}/></button>}</div></header>;
 if(!data)return <div className="app-shell minimal-app">{header}<main className="location-initial-loading" role="status"><p>{error||"در حال آماده‌سازی همراه خرید…"}</p>{error&&<button className="button" onClick={()=>reload().catch(e=>setError(e.message))}>تلاش دوباره</button>}</main></div>;
 if(!data.session.preferences.locationConfirmed||choosingLocation)return <div className="app-shell minimal-app">{header}<LocationPicker initialLocation={data.session.preferences.location} busy={busy} error={error} onConfirm={location=>{act("preferences",{preferences:{location,locationConfirmed:true}}).then(success=>{if(success)setChoosingLocation(false)})}} onCancel={data.session.preferences.locationConfirmed?()=>setChoosingLocation(false):undefined}/></div>;
 return <div className="app-shell minimal-app">{header}<main className="shopping-stream">
   {!messages.length&&<div className="minimal-welcome"><span className="welcome-navigation"><Navigation size={30}/></span><h1>چی لازم داری،<br/>کجا برویم؟</h1><p>نیازت را بگو؛ مدل مناسب و مسیر خرید حضوری را با هم پیدا کنیم.</p><div className="minimal-suggestions"><button disabled={busy} onClick={()=>send("همین امشب شارژر سامسونگ می‌خواهم. پیاده می‌روم و ترجیح می‌دهم بیشتر از ۲ کیلومتر راه نروم.")}>شارژر برای همین امشب</button><button disabled={busy} onClick={()=>send("کفش برای پیاده‌روی روزمره می‌خواهم؛ کمکم کن مدل مناسب را انتخاب کنم.")}>کمکم کن کفش مناسب انتخاب کنم</button></div></div>}
   {messages.length>2&&<><button className="text-button history-toggle" aria-label="نمایش مکالمه" aria-expanded={conversationOpen} onClick={()=>setConversationOpen(v=>!v)}>گفتگوهای قبلی<ChevronDown size={16}/></button>{conversationOpen&&<div className="conversation-history">{messages.slice(0,-2).map(m=><div key={m.id} className={`message ${m.role}`}><p>{m.role==="assistant"?customerText(m.text):m.text}</p></div>)}</div>}</>}
   <div ref={answer} className="stream-answer">{lastUser&&<p className="user-request">{lastUser.text}</p>}{busy?<p className="mobile-latest-message stream-working" role="status"><span className="loading-dots"/>در حال بررسی شرایط خرید…</p>:lastAnswer&&<div className="mobile-latest-message stream-response"><p>{customerText(lastAnswer.text)}</p></div>}</div>
   <PreferencePanel preferences={data.session.preferences} busy={busy} onApply={preferences=>act("preferences",{preferences})} onChooseLocation={()=>setChoosingLocation(true)}/>
   <ShoppingCanvas data={data} busy={busy} act={act}/>
   <div className="composer-area">{error&&<div className="error-banner" role="alert"><p>{error}</p><button aria-label="بستن پیام خطا" onClick={()=>setError("")}><X size={16}/></button><button className="text-button" onClick={()=>reload().catch(e=>setError(e.message))}>بارگذاری دوباره</button></div>}<form className="composer" onSubmit={e=>{e.preventDefault();if(document.activeElement?.closest(".media-popover"))return;send(input)}}><div className="composer-tools"><VoiceInput contextKey={`${data.session.id}:${data.session.version}`} onTranscriptReady={send} disabled={busy}/><ImageInput contextKey={`${data.session.id}:${data.session.version}`} onImageModelRecognized={query=>{setInput(query);field.current?.focus()}} disabled={busy}/></div><label className="sr-only" htmlFor="shopping-message">نیاز یا مدل مورد نظر</label><input id="shopping-message" ref={field} value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} placeholder="چی لازم داری؟"/><button className="send-button" disabled={!input.trim()||busy} aria-label="ارسال پیام"><Send size={18}/></button></form><p className="composer-disclosure">قیمت، موجودی و ساعت نهایی را پیش از حرکت تأیید کنید.</p></div>
 </main></div>;
}
