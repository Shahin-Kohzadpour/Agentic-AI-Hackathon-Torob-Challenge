"use client";
import {useEffect,useRef,useState} from "react";
import dynamic from "next/dynamic";
import {ArrowLeft,Car,Clock3,Footprints,MapPin,Navigation,RefreshCw} from "lucide-react";
import type {WorkflowSnapshot} from "@/lib/workflow";
import type {ShoppingDecision} from "@/lib/services/decision";
import {formatToman} from "@/lib/normalize";
import {customerText} from "@/lib/customer-copy";
const StoreMap=dynamic(()=>import("../map/StoreMap"),{ssr:false,loading:()=> <div className="map-placeholder">در حال آماده‌سازی نقشه…</div>});
type Action=(action:string,data?:Record<string,unknown>)=>void;
const time=(s:string)=>new Date(s).toLocaleTimeString("fa-IR",{timeZone:"Asia/Tehran",hour:"2-digit",minute:"2-digit"});
const labels={open:"فرصت خرید پس از رسیدن",closing:"فرصت خرید کافی نیست",closed:"بسته در زمان رسیدن",unknown:"ساعت نیازمند تأیید"};
export default function JourneyDecision({data,busy,act}:{data:WorkflowSnapshot;busy:boolean;act:Action}) {
  const [decision,setDecision]=useState<ShoppingDecision|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0),[selected,setSelected]=useState<string|null>(null);
  const refs=useRef<Record<string,HTMLElement|null>>({}),mapArea=useRef<HTMLDivElement>(null);
  const p=data.session.preferences;
  useEffect(()=>{
    const request=new AbortController();setLoading(true);setError("");setDecision(null);
    fetch("/api/decision",{cache:"no-store",signal:request.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error);if(body.version===data.session.version){setDecision(body);setSelected(body.shops[0]?.id||body.hubs[0]?.id||null);}}).catch(e=>{if(!request.signal.aborted)setError(e.message||"مسیر در دسترس نیست.")}).finally(()=>{if(!request.signal.aborted)setLoading(false)});
    return()=>request.abort();
  },[data.session.version,retry]);
  const apply=(preferences:Record<string,unknown>)=>act("preferences",{preferences});
  function chooseCard(id:string){setSelected(id);mapArea.current?.scrollIntoView({block:"start",behavior:"smooth"})}
  function choosePin(id:string){setSelected(id);refs.current[id]?.scrollIntoView({block:"nearest",behavior:"smooth"});}
  const pins=decision?[...decision.shops.filter(c=>c.offer.lat!==null&&c.offer.lon!==null).map((c,i)=>({id:c.id,name:`${i+1}. ${c.offer.shop_name}`,lat:c.offer.lat!,lon:c.offer.lon!,price_toman:c.offer.price_toman,location_label:labels[c.status],kind:"shop" as const,isSelected:selected===c.id})),...decision.hubs.map(h=>({id:h.id,name:h.hub_name,lat:h.lat,lon:h.lon,price_toman:null,kind:"area" as const,location_label:"محدودهٔ خرید؛ ساعت و موجودی نامعلوم",isSelected:selected===h.id}))]:[];
  return <section className="journey-decision" aria-label="تصمیم مراجعه" data-version={decision?.version??-1}>
    <div className="journey-controls" aria-label="تغییر شرایط رفت‌وآمد"><button disabled={busy} aria-pressed={(p.travelMode||"walking")==="walking"} onClick={()=>apply({travelMode:"walking"})}><Footprints size={17}/>پیاده</button><button disabled={busy} aria-pressed={p.travelMode==="driving"} onClick={()=>apply({travelMode:"driving"})}><Car size={17}/>با ماشین</button><button disabled={busy} onClick={()=>apply({departureAt:new Date().toISOString(),arrivalAt:null,requireOpen:false,urgent:true})}><Clock3 size={17}/>حرکت الان</button></div>
    <p className="journey-departure">حرکت: {p.departureAt?new Date(p.departureAt).toLocaleString("fa-IR",{timeZone:"Asia/Tehran",dateStyle:"short",timeStyle:"short"}):"اکنون"}{p.radiusKm!==null?` · ${p.radiusMode==="preferred"?"ترجیحاً":"حداکثر"} ${p.radiusKm.toLocaleString("fa-IR")} کیلومتر`:""}</p>
    {loading&&<p className="journey-loading" role="status"><span className="loading-dots"/>بررسی مسیر، زمان رسیدن و ساعت فروشگاه‌ها…</p>}
    {error&&<div className="truth-note" role="status"><p>{error}</p><button className="text-button" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={16}/>تلاش دوباره</button></div>}
    {decision&&<><p className="decision-summary" role="status">{decision.summary}</p><div ref={mapArea} className="decision-map-anchor"><StoreMap userLocation={{...p.location,name:p.location.label}} stores={pins} onSelectStore={choosePin} className="store-map decision-map"/></div><p className="map-legend"><span>● فروشگاه</span><span>◆ محدودهٔ خرید</span><span>خط‌چین: فاصلهٔ هوایی</span></p>
    <div className="decision-cards">{decision.shops.map((c,i)=><article ref={el=>{refs.current[c.id]=el}} key={c.id} className={`decision-card ${selected===c.id?"selected":""}`}>
      <button className="decision-card-title" aria-pressed={selected===c.id} onClick={()=>chooseCard(c.id)}><span className="map-number">{(i+1).toLocaleString("fa-IR")}</span><strong>{c.offer.shop_name}</strong><MapPin size={18}/></button>
      <span className={`tag ${c.status==="open"?"tag-green":"tag-neutral"}`}>{labels[c.status]}</span>
      <p className="decision-product">{c.productTitle}</p><strong className="decision-price">{formatToman(c.offer.price_toman)}</strong>
      <p className="decision-eta"><Navigation size={15}/>{c.route.minutes.toLocaleString("fa-IR")} دقیقه · {c.route.distanceKm.toLocaleString("fa-IR",{maximumFractionDigits:1})} کیلومتر {c.route.source==="neshan"?"مسیر نشان":"تقریبی"} · رسیدن {time(c.arrivalAt)}</p>
      <p>{c.reason}</p>{c.outsideRadius&&<p className="outside-radius">بیرون از محدودهٔ {p.radiusMode==="preferred"?"ترجیحی":"قطعی"} شما{!c.withinLimit?"؛ نیازمند تغییر محدوده با انتخاب شما":""}</p>}
      <p className="decision-address">{c.offer.address||"نشانی دقیق ثبت نشده"}{c.offer.floor_unit&&<strong> · {c.offer.floor_unit}</strong>}</p>
      <details><summary>ساعت، قیمت و شرایط</summary><p>{c.hoursSummary}</p><p>{c.route.source==="estimate"?"زمان و مسافت، تخمین از فاصلهٔ هوایی‌اند و مسیر واقعی نیستند. پیش از حرکت مسیریاب را بررسی کنید.":"برآورد نشان بر اساس شرایط هنگام دریافت مسیر است و ممکن است تغییر کند."}</p><p>آخرین تغییر قیمت: {c.offer.last_price_changed_at?new Date(c.offer.last_price_changed_at).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"}):"نامعلوم"}</p><p>{customerText(c.offer.payment_summary)}</p><p>{c.offer.warranty_summary}</p></details>
      <div className="decision-actions">{!c.withinLimit?<button className="button button-small" disabled={busy} onClick={()=>apply({radiusKm:Math.ceil(c.route.distanceKm+0.2)})}>افزایش محدوده تا این فروشگاه</button>:data.session.selectedProductId!==c.offer.product_id?<button className="button button-small" disabled={busy} onClick={()=>act("select_product",{productId:c.offer.product_id})}>انتخاب این مدل<ArrowLeft size={16}/></button>:<button className="button button-small" disabled={busy||c.status==="closed"||c.status==="closing"} onClick={()=>act("check",{offerId:c.offer.offer_id,verifyUnknownHours:c.status==="unknown"})}>بررسی شرایط خرید<ArrowLeft size={16}/></button>}<a className="text-button" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&origin=${p.location.lat},${p.location.lon}&destination=${c.offer.lat},${c.offer.lon}&travelmode=${p.travelMode||"walking"}`}>مسیریابی</a></div>
    </article>)}</div>
    {decision.hubs.length>0&&<div className="decision-hubs"><h3>محدوده‌های خرید نزدیک برای بررسی</h3>{decision.hubs.map(h=><article key={h.id} ref={el=>{refs.current[h.id]=el}} className={`decision-card area-card ${selected===h.id?"selected":""}`}><button className="decision-card-title" aria-pressed={selected===h.id} onClick={()=>chooseCard(h.id)}><span className="area-symbol">◆</span><strong>{h.hub_name}</strong><MapPin size={18}/></button><p>{h.route?`${h.route.minutes.toLocaleString("fa-IR")} دقیقه و ${h.route.distanceKm.toLocaleString("fa-IR",{maximumFractionDigits:1})} کیلومتر، تخمین تقریبی` :"فاصله مشخص نیست"}</p><p>ممکن است فروشگاه‌های بیشتری برای این گروه کالا پیدا کنید. بازبودن امشب، موجودی این مدل، قیمت و پذیرندگی اقساط در این محدوده تأیید نشده است.</p><details><summary>دلیل پیشنهاد و منبع</summary><p>{customerText(h.description)}</p><p>{h.coordinateNote}</p><a href={h.sourceUrl} target="_blank" rel="noreferrer">{customerText(h.sourceLabel)}</a></details><a className="text-button" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&origin=${p.location.lat},${p.location.lon}&destination=${h.lat},${h.lon}&travelmode=${p.travelMode||"walking"}`}>بررسی مسیر این محدوده<ArrowLeft size={16}/></a></article>)}</div>}
    <p className="decision-footnote">{decision.examined.toLocaleString("fa-IR")} فروشگاه دارای آفر با حفظ بودجه و روش پرداخت بررسی شد. این پوشش، تمام فروشگاه‌های تهران نیست.{/شارژر/.test(data.session.query)&&" نوع درگاه، توان و سازگاری شارژر با مدل گوشی را پیش از خرید تأیید کنید."}</p></>}
  </section>;
}
