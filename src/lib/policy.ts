import {AppError} from "./validation";
import { normalizePersian } from "./normalize";
import type { Preferences } from "@/types/workflow";

type Day = { status?: string; shifts?: Array<{ start_time?: string; end_time?: string }> };
export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw || raw === "null") return fallback;
  try { return JSON.parse(raw) ?? fallback; } catch { return fallback; }
}
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES: Record<string, string> = {sat:"شنبه",sun:"یکشنبه",mon:"دوشنبه",tue:"سه‌شنبه",wed:"چهارشنبه",thu:"پنجشنبه",fri:"جمعه"};
function tehranParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Tehran",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(at);
  const get = (k: string) => parts.find(p=>p.type===k)?.value || "";
  return { day:get("weekday").toLowerCase(), minute:Number(get("hour"))*60+Number(get("minute")) };
}
function minutes(value?: string) {
  if (!value || !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const [h,m]=value.split(":").map(Number);
  return h<=23 && m<=59 ? h*60+m : null;
}
function dayIntervals(day?: Day): Array<[number,number]> {
  if (day?.status !== "declared") return [];
  return (day.shifts || []).flatMap(s=>{
    const start=minutes(s.start_time), end=minutes(s.end_time);
    if(start===null || end===null || start===end) return [];
    return [[start, end<start ? end+1440 : end] as [number,number]];
  });
}
export function hoursEvidence(raw: unknown, arrivalAt: string | null = null, bufferMinutes = 20) {
  const hours=parseJson<Record<string,Day>>(raw,{});
  const at=arrivalAt ? new Date(arrivalAt) : new Date();
  if(!Number.isFinite(at.getTime())) return {status:"unknown" as const, summary:"زمان مراجعه معتبر نیست"};
  const {day,minute}=tehranParts(at);
  const previous=DAYS[(DAYS.indexOf(day)+6)%7];
  const intervals=[...dayIntervals(hours[day]),...dayIntervals(hours[previous]).filter(([,end])=>end>1440).map(([start,end])=>[start-1440,end-1440] as [number,number])];
  const open=intervals.some(([start,end])=>minute>=start && minute+bufferMinutes<=end);
  const declared=hours[day];
  const summary=declared?.status==="closed" ? `${DAY_NAMES[day]}: تعطیل اعلام شده` : declared?.status==="declared" && dayIntervals(declared).length
    ? `${DAY_NAMES[day]}: `+(declared.shifts||[]).filter(s=>minutes(s.start_time)!==minutes(s.end_time)).map(s=>`${s.start_time?.slice(0,5)} تا ${s.end_time?.slice(0,5)}`).join("، ")
    : "ساعت کاری این روز ثبت نشده";
  return {status:open ? "open_declared" as const : declared?.status==="closed" || intervals.length ? "closed_declared" as const : "unknown" as const, summary};
}
export function paymentEvidence(raw: unknown, price: number, category: string) {
  const options=parseJson<Array<Record<string,unknown>>>(raw,[]);
  if(!Array.isArray(options)) return {eligible:false,status:"unknown",summary:"اطلاعات پرداخت ثبت نشده"};
  let reason="پذیرندگی حضوری ترب‌پی در داده ثبت نشده";
  for(const option of options) {
    const provider=normalizePersian(String(option.provider_name||"")).replace(/\s/g,"");
    if(!["torobpay","تربپی"].includes(provider)) continue;
    if(option.channel!=="in_person") {reason="کانال پذیرندگی ترب‌پی نامعلوم است";continue;}
    const min=option.min_price_toman, max=option.max_price_toman;
    if((min!==null && min!==undefined && (typeof min!=="number" || min<0)) || (max!==null && max!==undefined && (typeof max!=="number" || max<=0))) {reason="محدودیت مبلغ ترب‌پی نیاز به بررسی دارد";continue;}
    if(typeof min==="number" && typeof max==="number" && min>max) {reason="محدودیت مبلغ ترب‌پی متناقض است";continue;}
    if((typeof min==="number" && price<min)||(typeof max==="number" && price>max)) {reason="مبلغ خارج از محدودهٔ پذیرندگی ترب‌پی است";continue;}
    const categories=option.category_names;
    if(Array.isArray(categories)&&categories.length&&!categories.some(c=>normalizePersian(String(c))===normalizePersian(category))) {reason="دستهٔ محصول در پذیرندگی ترب‌پی احراز نشده";continue;}
    return {eligible:true,status:"listed_in_person",summary:"پذیرندگی حضوری ترب‌پی در دیتاست؛ مبلغ نهایی اقساط نیازمند بررسی"};
  }
  return {eligible:false,status:"unknown",summary:reason};
}
export function validatePreferences(value: Record<string,unknown>, current: Preferences): Preferences {
  const next=structuredClone(current);
  if("travelMode" in value) {if(!["walking","driving"].includes(String(value.travelMode)))throw new AppError("روش رفت‌وآمد معتبر نیست.");next.travelMode=value.travelMode as Preferences["travelMode"];}
  if("radiusMode" in value) {if(!["hard","preferred"].includes(String(value.radiusMode)))throw new AppError("نوع محدوده معتبر نیست.");next.radiusMode=value.radiusMode as Preferences["radiusMode"];}
  if("urgent" in value) {if(typeof value.urgent!=="boolean")throw new AppError("شرط فوریت معتبر نیست.");next.urgent=value.urgent;}
  if("departureAt" in value) {
    if(value.departureAt!==null&&(typeof value.departureAt!=="string"||!Number.isFinite(Date.parse(value.departureAt))||!/(Z|[+-]\d{2}:\d{2})$/.test(value.departureAt)))throw new AppError("زمان حرکت معتبر نیست.");
    next.departureAt=value.departureAt as string|null;
  }
  for(const key of ["budget","radiusKm"] as const) if(key in value) {
    const n=value[key];
    if(n!==null&&(typeof n!=="number"||!Number.isFinite(n)||n<=0||(key==="budget"&&!Number.isSafeInteger(n))||n>(key==="budget"?100_000_000_000_000:100))) throw new AppError("بودجه یا شعاع معتبر نیست.");
    next[key]=n as number|null;
  }
  if("payment" in value) {if(!["any","torobpay"].includes(String(value.payment))) throw new AppError("روش پرداخت معتبر نیست.");next.payment=value.payment as Preferences["payment"];}
  if("requireOpen" in value) {if(typeof value.requireOpen!=="boolean") throw new AppError("شرط زمان معتبر نیست.");next.requireOpen=value.requireOpen;}
  if("locationConfirmed" in value) {
    if(typeof value.locationConfirmed!=="boolean" || (value.locationConfirmed && !value.location)) throw new AppError("موقعیت انتخابی را تأیید کنید.");
    next.locationConfirmed=value.locationConfirmed;
  }
  if("arrivalAt" in value) {
    if(value.arrivalAt!==null&&(typeof value.arrivalAt!=="string"||!Number.isFinite(Date.parse(value.arrivalAt))||!/(Z|[+-]\d{2}:\d{2})$/.test(value.arrivalAt))) throw new AppError("زمان مراجعه را با منطقهٔ زمانی وارد کنید.");
    next.arrivalAt=value.arrivalAt as string|null;
  }
  if("location" in value) {
    const loc=value.location as Record<string,unknown>;
    if(!loc||typeof loc.lat!=="number"||typeof loc.lon!=="number"||!Number.isFinite(loc.lat)||!Number.isFinite(loc.lon)||loc.lat<35.3||loc.lat>36.1||loc.lon<50.7||loc.lon>52||typeof loc.label!=="string"||loc.label.length>150) throw new AppError("موقعیت باید در محدودهٔ تهران باشد.");
    next.location={lat:loc.lat,lon:loc.lon,label:loc.label};
  }
  for(const key of ["useCase","feature"] as const) if(key in value) {if(value[key]!==null&&(typeof value[key]!=="string"||String(value[key]).length>300)) throw new AppError("ترجیح معتبر نیست.");next[key]=value[key] as string|null;}
  if(next.requireOpen&&!next.arrivalAt)throw new AppError("برای الزام بازبودن، زمان مراجعه را انتخاب کنید.");
  return next;
}
export function warrantySummary(raw: string | null): string {
  if(!raw||raw==="null") return "گارانتی ثبت نشده";
  const w=parseJson<Record<string,unknown>|null>(raw,null);
  if(w) return [w.period_months ? `${w.period_months} ماه` : "",w.provider,w.description].filter(Boolean).join("، ")||"جزئیات گارانتی ثبت نشده";
  return raw;
}
