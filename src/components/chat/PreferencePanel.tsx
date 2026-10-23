"use client";
import { useEffect, useState } from "react";
import { ChevronDown, MapPin, SlidersHorizontal } from "lucide-react";
import type { Preferences } from "@/types/workflow";
import { formatToman, normalizePersian } from "@/lib/normalize";

function localTime(value:string|null) {return value?new Date(new Date(value).getTime()+210*60000).toISOString().slice(0,16):"";}
export default function PreferencePanel({preferences,busy,onApply,onChooseLocation}:{preferences:Preferences;busy:boolean;onApply:(p:Partial<Preferences>)=>void;onChooseLocation:()=>void}) {
 const [expanded,setExpanded]=useState(false);
 const [budget,setBudget]=useState(""),[radius,setRadius]=useState(""),[arrival,setArrival]=useState(""),[payment,setPayment]=useState(preferences.payment),[requireOpen,setRequireOpen]=useState(false),[error,setError]=useState("");
 const preferencesKey=JSON.stringify(preferences);
 useEffect(()=>{const current:Preferences=JSON.parse(preferencesKey);setBudget(current.budget?String(current.budget):"");setRadius(current.radiusKm?String(current.radiusKm):"");setArrival(localTime(current.arrivalAt));setPayment(current.payment);setRequireOpen(current.requireOpen);setExpanded(false)},[preferencesKey]);
 const numeric=(s:string)=>Number(normalizePersian(s).replace(/[,٬]/g,""));
 function submit(e:React.FormEvent) {
  e.preventDefault();setError("");
  const b=budget?numeric(budget):null,r=radius?numeric(radius):null;
  if(b!==null&&(!Number.isSafeInteger(b)||b<1)){setError("بودجه را به تومان و عدد صحیح وارد کنید.");return;}
  if(r!==null&&(!Number.isFinite(r)||r<=0||r>100)){setError("شعاع را بین صفر و ۱۰۰ کیلومتر وارد کنید.");return;}
  onApply({budget:b,radiusKm:r,payment,arrivalAt:arrival?`${arrival}:00+03:30`:null,requireOpen});
 }
 return <details className="preferences" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary aria-label="ویرایش شرایط خرید"><SlidersHorizontal size={19}/><span className="preference-summary"><strong>شرایط خرید شما</strong><span>{preferences.budget?formatToman(preferences.budget):"بودجه آزاد"} · {preferences.payment==="torobpay"?"ترب‌پی حضوری":"همهٔ روش‌های پرداخت"}{preferences.radiusKm?` · شعاع ${preferences.radiusKm.toLocaleString("fa-IR")} کیلومتر`:""}{preferences.requireOpen?" · باز در زمان مراجعه":""}</span></span><span className="summary-edit">ویرایش<ChevronDown size={16}/></span></summary><form onSubmit={submit}>
  <div className="filter-grid"><label>سقف بودجه <span className="muted">(تومان)</span><input inputMode="numeric" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="مثلاً ۴۲۰۰۰۰۰"/></label>
  <label>شعاع جست‌وجو <span className="muted">(کیلومتر)</span><input inputMode="decimal" value={radius} onChange={e=>setRadius(e.target.value)} placeholder="بدون محدودیت"/></label>
  <div className="location-filter"><span>مبدأ حرکت</span><button type="button" className="location-filter-button" onClick={onChooseLocation}><MapPin size={18}/><span>{preferences.location.label}</span><span className="text-button">تغییر</span></button></div>
  <label>زمان مراجعه <span className="muted">(تهران)</span><input type="datetime-local" value={arrival} onChange={e=>setArrival(e.target.value)}/></label></div>
  <div className="filter-footer"><label className="check-label"><input type="checkbox" checked={payment==="torobpay"} onChange={e=>setPayment(e.target.checked?"torobpay":"any")}/>ترب‌پی حضوری الزامی است</label><label className="check-label"><input type="checkbox" checked={requireOpen} onChange={e=>setRequireOpen(e.target.checked)}/>طبق ساعات ثبت‌شده هنگام مراجعه باز باشد</label></div>
  <div className="filter-actions"><button className="button button-small" disabled={busy}>اعمال شرایط</button></div>
  {error&&<p className="error-text" role="alert">{error}</p>}
 </form></details>;
}
