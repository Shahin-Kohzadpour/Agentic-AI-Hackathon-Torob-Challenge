"use client";
import { useEffect, useState } from "react";
import { LocateFixed, MapPin, SlidersHorizontal } from "lucide-react";
import type { Preferences } from "@/types/workflow";
import { normalizePersian } from "@/lib/normalize";

const AREAS=[{label:"جمهوری / حافظ",lat:35.6948,lon:51.4089},{label:"چهارراه ولیعصر",lat:35.7008,lon:51.4056},{label:"میدان ونک",lat:35.7575,lon:51.4099},{label:"میدان منیریه",lat:35.6821,lon:51.4011},{label:"امین حضور",lat:35.6845,lon:51.4367}];
function localTime(value:string|null) {return value?new Date(new Date(value).getTime()+210*60000).toISOString().slice(0,16):"";}
export default function PreferencePanel({preferences,busy,onApply}:{preferences:Preferences;busy:boolean;onApply:(p:Partial<Preferences>)=>void}) {
 const [budget,setBudget]=useState(""),[radius,setRadius]=useState(""),[arrival,setArrival]=useState(""),[payment,setPayment]=useState(preferences.payment),[requireOpen,setRequireOpen]=useState(false),[location,setLocation]=useState(preferences.location),[error,setError]=useState("");
 useEffect(()=>{setBudget(preferences.budget?String(preferences.budget):"");setRadius(preferences.radiusKm?String(preferences.radiusKm):"");setArrival(localTime(preferences.arrivalAt));setPayment(preferences.payment);setRequireOpen(preferences.requireOpen);setLocation(preferences.location)},[preferences]);
 const numeric=(s:string)=>Number(normalizePersian(s).replace(/[,٬]/g,""));
 function submit(e:React.FormEvent) {
  e.preventDefault();setError("");
  const b=budget?numeric(budget):null,r=radius?numeric(radius):null;
  if(b!==null&&(!Number.isSafeInteger(b)||b<1)){setError("بودجه را به تومان و عدد صحیح وارد کنید.");return;}
  if(r!==null&&(!Number.isFinite(r)||r<=0||r>100)){setError("شعاع را بین صفر و ۱۰۰ کیلومتر وارد کنید.");return;}
  onApply({budget:b,radiusKm:r,payment,arrivalAt:arrival?`${arrival}:00+03:30`:null,requireOpen,location});
 }
 function locate() {
  if(!navigator.geolocation){setError("مرورگر موقعیت را پشتیبانی نمی‌کند؛ محله را انتخاب کنید.");return;}
  navigator.geolocation.getCurrentPosition(p=>{setLocation({lat:p.coords.latitude,lon:p.coords.longitude,label:"موقعیت انتخابی دستگاه"});setError("");},()=>setError("دسترسی به موقعیت داده نشد؛ انتخاب دستی محله در دسترس است."),{timeout:8000,maximumAge:60000});
 }
 return <details className="preferences" open><summary><SlidersHorizontal size={18}/><span>شرایط خرید شما</span><span className="summary-note">قابل تغییر در هر مرحله</span></summary><form onSubmit={submit}>
  <div className="filter-grid"><label>سقف بودجه <span className="muted">(تومان)</span><input inputMode="numeric" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="مثلاً ۴۲۰۰۰۰۰"/></label>
  <label>شعاع جست‌وجو <span className="muted">(کیلومتر)</span><input inputMode="decimal" value={radius} onChange={e=>setRadius(e.target.value)} placeholder="بدون محدودیت"/></label>
  <label>مبدأ حرکت<select value={AREAS.find(a=>a.lat===location.lat&&a.lon===location.lon)?.label||"custom"} onChange={e=>{const area=AREAS.find(a=>a.label===e.target.value);if(area)setLocation({...area,label:`مبدأ تقریبی محله: ${area.label}`})}}>{AREAS.map(a=><option key={a.label}>{a.label}</option>)}<option value="custom">{location.label}</option></select></label>
  <label>زمان مراجعه <span className="muted">(تهران)</span><input type="datetime-local" value={arrival} onChange={e=>setArrival(e.target.value)}/></label></div>
  <div className="filter-footer"><label className="check-label"><input type="checkbox" checked={payment==="torobpay"} onChange={e=>setPayment(e.target.checked?"torobpay":"any")}/>ترب‌پی حضوری الزامی است</label><label className="check-label"><input type="checkbox" checked={requireOpen} onChange={e=>setRequireOpen(e.target.checked)}/>طبق ساعات ثبت‌شده هنگام مراجعه باز باشد</label></div>
  <div className="filter-actions"><span className="location-note"><MapPin size={14}/>{location.label}</span><button type="button" className="text-button" onClick={locate}><LocateFixed size={16}/>موقعیت دستگاه</button><button className="button button-small" disabled={busy}>اعمال شرایط</button></div>
  {error&&<p className="error-text" role="alert">{error}</p>}
 </form></details>;
}
