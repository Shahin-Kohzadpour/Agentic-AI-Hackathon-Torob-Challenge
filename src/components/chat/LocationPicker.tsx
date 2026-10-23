"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, LocateFixed, MapPin, Navigation, ShieldCheck } from "lucide-react";
import type { Preferences } from "@/types/workflow";

const LocationMap=dynamic(()=>import("../map/LocationMap"),{ssr:false,loading:()=> <div className="location-map-loading" role="status">در حال باز کردن نقشه…</div>});
type Point=Preferences["location"];
export default function LocationPicker({initialLocation,busy,error,onConfirm,onCancel}:{initialLocation:Point;busy:boolean;error:string;onConfirm:(point:Point)=>void;onCancel?:()=>void}) {
  const [mode,setMode]=useState<"choice"|"map">("choice");
  const [point,setPoint]=useState<Point>({...initialLocation,label:"موقعیت انتخابی روی نقشه"});
  const [locating,setLocating]=useState(false),[locationError,setLocationError]=useState("");
  const generation=useRef(0),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{const requests=generation;heading.current?.focus();return()=>{requests.current++;};},[mode]);
  function manual(){generation.current++;setLocating(false);setLocationError("");setMode("map");}
  function locate(){
    setLocationError("");
    if(!navigator.geolocation){setLocationError("موقعیت دستگاه در این مرورگر در دسترس نیست؛ روی نقشه انتخاب کنید.");return;}
    const request=++generation.current;setLocating(true);
    navigator.geolocation.getCurrentPosition(result=>{
      if(request!==generation.current)return;
      setLocating(false);
      const {latitude:lat,longitude:lon}=result.coords;
      if(lat<35.3||lat>36.1||lon<50.7||lon>52){setLocationError("فعلاً فروشگاه‌های تهران را پوشش می‌دهیم. محل خریدتان در تهران را روی نقشه انتخاب کنید.");return;}
      onConfirm({lat,lon,label:"موقعیت فعلی من"});
    },failure=>{
      if(request!==generation.current)return;
      setLocating(false);
      setLocationError(failure.code===1?"دسترسی به موقعیت داده نشد. می‌توانید محل دلخواه را روی نقشه انتخاب کنید.":"دریافت موقعیت انجام نشد؛ دوباره تلاش کنید یا روی نقشه انتخاب کنید.");
    },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  }
  return <main className={`location-onboarding ${mode==="map"?"map-mode":""}`} aria-busy={busy}>
    {mode==="choice"?<>
      <div className="location-art" aria-hidden="true"><svg viewBox="0 0 280 160"><path d="M0 40H115L165 0M0 120H75L155 40H280M65 160L120 105H280M35 0V160M220 0V160"/><path className="location-route" d="M60 120H100L150 70H210"/><circle cx="60" cy="120" r="6"/></svg><span><MapPin size={34}/></span><div className="location-city">تهران</div></div>
      <p className="eyebrow">اول، نزدیک شما</p><h1 ref={heading} tabIndex={-1}>خرید را از کجا<br/>شروع می‌کنید؟</h1>
      <p className="location-intro">موقعیتتان را انتخاب کنید تا فروشگاه‌های نزدیک و مسیر رسیدن به آن‌ها را پیدا کنیم.</p>
      <div className="location-choices">
        <button className="location-choice gps-choice" disabled={busy||locating} onClick={locate}>{locating?<LoaderCircle className="location-spinner" size={25}/>:<LocateFixed size={25}/>}<span><strong>{locating?"در حال دریافت موقعیت…":"استفاده از موقعیت فعلی"}</strong><small>با GPS گوشی</small></span><ArrowLeft size={20}/></button>
        <button className="location-choice" disabled={busy} onClick={manual}><MapPin size={25}/><span><strong>خودم روی نقشه انتخاب می‌کنم</strong><small>خانه، محل کار یا هر نقطهٔ دلخواه</small></span><ArrowLeft size={20}/></button>
      </div>
      <p className="location-privacy"><ShieldCheck size={17}/>دسترسی به موقعیت فقط با انتخاب شما فعال می‌شود.</p>
    </>:<>
      <div className="location-map-heading"><button className="icon-button" onClick={()=>{generation.current++;setMode("choice")}} aria-label="بازگشت به روش انتخاب موقعیت" disabled={busy}><ArrowRight size={22}/></button><div><h1 ref={heading} tabIndex={-1}>موقعیت را روی نقشه انتخاب کنید</h1><p>نقشه را جابه‌جا کنید؛ نشان قرمز محل شروع شماست.</p></div></div>
      <div className="location-map-frame"><LocationMap initialLocation={point} onChange={setPoint}/><div className="location-center-pin" aria-hidden="true"><MapPin size={42} fill="currentColor"/><span/></div><span className="location-map-tip"><Navigation size={15}/>نقطهٔ دلخواه را هم می‌توانید لمس کنید</span></div>
      <div className="location-map-confirm"><p><MapPin size={18}/><span>موقعیت انتخابی در تهران<small dir="ltr">{point.lat.toFixed(5)}, {point.lon.toFixed(5)}</small></span></p><button className="button" disabled={busy} onClick={()=>onConfirm(point)}>{busy?<LoaderCircle className="location-spinner" size={19}/>:<Check size={19}/>}تأیید موقعیت و ادامه<ArrowLeft size={18}/></button></div>
    </>}
    {(locationError||error)&&<p className="location-error" role="alert">{locationError||error}</p>}
    {onCancel&&<button className="text-button location-cancel" disabled={busy} onClick={onCancel}>ادامه با موقعیت قبلی</button>}
  </main>;
}
