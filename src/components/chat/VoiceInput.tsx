"use client";
import {useEffect,useRef,useState} from "react";
import {Mic,MicOff,X,Check} from "lucide-react";
export default function VoiceInput({onTranscriptReady,disabled,contextKey}:{onTranscriptReady:(text:string)=>void;disabled?:boolean;contextKey?:string}){
 const [recording,setRecording]=useState(false),[transcript,setTranscript]=useState(""),[error,setError]=useState("");
 const generation=useRef(0);
 const recognition=useRef<any>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{generation.current++;recognition.current?.abort();if(timer.current)clearTimeout(timer.current);setRecording(false);setTranscript("");setError("");return()=>{recognition.current?.abort();if(timer.current)clearTimeout(timer.current)}},[contextKey]);
 function stop(cancel=false){if(cancel)generation.current++;if(timer.current)clearTimeout(timer.current);if(cancel)recognition.current?.abort();else recognition.current?.stop();setRecording(false);if(cancel)setTranscript("");}
 function start(){
  if(recording){stop();return;}
  const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  if(!Recognition){setError("ورودی صوتی در این مرورگر پشتیبانی نمی‌شود؛ متن درخواست را تایپ کنید.");return;}
  setError("");setTranscript("");const gen=++generation.current;const r=new Recognition();recognition.current=r;r.lang="fa-IR";r.continuous=false;r.interimResults=true;
  r.onresult=(event:any)=>{if(gen===generation.current)setTranscript(Array.from(event.results).map((result:any)=>result[0].transcript).join(" "));};
  r.onerror=(event:any)=>{if(gen!==generation.current)return;setRecording(false);setError(event.error==="not-allowed"?"دسترسی میکروفن داده نشد؛ تایپ همچنان در دسترس است.":"تبدیل صوت انجام نشد؛ دوباره تلاش کنید یا تایپ کنید.")};
  r.onend=()=>{if(gen!==generation.current)return;setRecording(false);if(timer.current)clearTimeout(timer.current)};
  try{r.start();setRecording(true);timer.current=setTimeout(()=>stop(),60000)}catch{setError("ضبط شروع نشد؛ دوباره تلاش کنید.")}
 }
 return <div className="media-control"><button className={`icon-button ${recording?"recording":""}`} type="button" disabled={disabled} onClick={start} title={recording?"توقف ضبط":"ورودی صوتی"} aria-label={recording?"توقف ضبط":"ورودی صوتی"}>{recording?<MicOff size={19}/>:<Mic size={19}/>}</button>{(transcript||recording||error)&&<div className="media-popover" role="dialog" aria-label="ورودی صوتی"><div className="section-heading"><strong>{recording?"در حال شنیدن؛ حداکثر یک دقیقه":"متن صوت را بررسی کنید"}</strong><button className="icon-button" aria-label="بستن ورودی صوتی" onClick={()=>{stop(true);setError("")}} type="button"><X size={17}/></button></div>{error&&<p className="error-text" role="status">{error}</p>}<label>متن قابل ویرایش<textarea rows={3} value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="پس از صحبت، مبلغ و نام مدل را بررسی کنید."/></label><div className="media-actions"><button type="button" className="text-button" onClick={()=>{stop(true);setError("")}}>انصراف</button><button type="button" className="button button-small" disabled={!transcript.trim()||recording} onClick={()=>{onTranscriptReady(transcript.trim());setTranscript("")}}><Check size={16}/>ارسال متن بررسی‌شده</button></div></div>}</div>;
}
