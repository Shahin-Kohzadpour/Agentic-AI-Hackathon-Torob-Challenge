import type {WorkflowSnapshot} from "../workflow";
import type {Preferences} from "@/types/workflow";
import {offersForProduct,type ShoppingOffer} from "./catalog";
import {getDatabase} from "../db";
import {hoursEvidence} from "../policy";
import {getLiveTrafficRoute,getPedestrianRoute} from "./neshan";
import {shoppingAreas} from "./areas";

export type VisitStatus="open"|"closing"|"closed"|"unknown";
export interface JourneyRoute {distanceKm:number;minutes:number;source:"neshan"|"estimate";observedAt:string}
export function estimatedRoute(distance:number,mode:Preferences["travelMode"]):JourneyRoute {
  return {distanceKm:Math.round(distance*1.3*100)/100,minutes:Math.max(1,Math.ceil(distance*1.3/(mode==="driving"?22:4.5)*60)+(mode==="driving"?5:0)),source:"estimate",observedAt:new Date().toISOString()};
}
export function assessVisit(raw:unknown,prefs:Preferences,route:JourneyRoute,now=new Date()) {
  const departure=new Date(prefs.departureAt||now.toISOString());
  const eta=new Date(departure.getTime()+route.minutes*60000);
  // A fixed appointment cannot be reached by leaving after the latest departure.
  const appointment=prefs.arrivalAt?new Date(prefs.arrivalAt):null;
  const late=Boolean(appointment&&eta>appointment);
  const at=appointment&&!late?appointment:eta;
  const instant=hoursEvidence(raw,at.toISOString(),0),withBuffer=hoursEvidence(raw,at.toISOString(),20);
  const status:VisitStatus=late?"closing":instant.status==="unknown"?"unknown":instant.status==="closed_declared"?"closed":withBuffer.status==="open_declared"?"open":"closing";
  return {status,arrivalAt:at.toISOString(),hoursSummary:instant.summary,reason:late?"با این زمان حرکت، به زمان مراجعهٔ انتخابی نمی‌رسید.":status==="open"?"طبق ساعت ثبت‌شده، پس از رسیدن دست‌کم ۲۰ دقیقه فرصت خرید دارید.":status==="closing"?"زمان کافی برای خرید پیش از تعطیلی باقی نمی‌ماند.":status==="closed"?"طبق ساعت ثبت‌شده، در زمان رسیدن بسته است.":"ساعت کاری این روز مشخص نیست؛ پیش از حرکت تأیید بگیرید."};
}
export type DecisionShop=ReturnType<typeof assessVisit>&{id:string;offer:ShoppingOffer;productTitle:string;route:JourneyRoute;outsideRadius:boolean;withinLimit:boolean};
const cache=new Map<string,{until:number;route:JourneyRoute}>();
export function cachedJourneyRoute(prefs:Preferences,offer:ShoppingOffer) {
  const key=[prefs.location.lat,prefs.location.lon,offer.lat,offer.lon,prefs.travelMode||"walking"].join(":");
  const value=cache.get(key);return value&&value.until>Date.now()?value.route:null;
}
async function routeFor(prefs:Preferences,offer:ShoppingOffer):Promise<JourneyRoute> {
  const fallback=estimatedRoute(offer.distance_km||0,prefs.travelMode);
  if(offer.lat===null||offer.lon===null)return fallback;
  const key=[prefs.location.lat,prefs.location.lon,offer.lat,offer.lon,prefs.travelMode||"walking"].join(":");
  const cached=cache.get(key);if(cached&&cached.until>Date.now())return cached.route;
  const value=prefs.travelMode==="driving"?await getLiveTrafficRoute(prefs.location.lat,prefs.location.lon,offer.lat,offer.lon):await getPedestrianRoute(prefs.location.lat,prefs.location.lon,offer.lat,offer.lon);
  let route=fallback;
  if(value)route={distanceKm:"distance_km" in value?value.distance_km:value.walking_distance_meters/1000,minutes:"duration_minutes" in value?value.duration_minutes:value.walking_duration_minutes,source:"neshan",observedAt:new Date().toISOString()};
  if(cache.size>200)cache.clear();cache.set(key,{until:Date.now()+60000,route});return route;
}
export async function buildDecision(data:WorkflowSnapshot) {
  const s=data.session,prefs=s.preferences;
  const products=data.selectedProduct?[data.selectedProduct]:s.products.slice(0,3);
  const hours=getDatabase().prepare("SELECT weekly_hours FROM shops WHERE shop_id=?");
  const seen=new Set<string>(),failed=new Set(data.failedShopIds);
  const candidates:DecisionShop[]=[];
  // Budget and payment are always hard requirements. Radius/time remain visible evidence.
  for(const p of products)for(const offer of offersForProduct(p.product_id,{...prefs,radiusKm:null,requireOpen:false},false)) {
    if(failed.has(offer.shop_id)||seen.has(offer.shop_id)||offer.distance_km===null)continue;seen.add(offer.shop_id);
    const route=estimatedRoute(offer.distance_km,prefs.travelMode),raw=(hours.get(offer.shop_id) as {weekly_hours:string}|undefined)?.weekly_hours;
    const outside=prefs.radiusKm!==null&&offer.distance_km>prefs.radiusKm;
    candidates.push({id:offer.shop_id,offer,productTitle:p.persian_title,route,...assessVisit(raw,prefs,route),outsideRadius:outside,withinLimit:!outside||prefs.radiusMode==="preferred"});
  }
  const rank=(d:DecisionShop)=>(d.withinLimit?0:100000)+(d.status==="open"?0:d.status==="unknown"?10000:d.status==="closing"?20000:30000)+d.route.minutes;
  candidates.sort((a,b)=>rank(a)-rank(b)||a.offer.price_toman-b.offer.price_toman);
  const shortlist=candidates.slice(0,3);
  // Include a known-open alternative outside a hard radius without silently relaxing it.
  const farOpen=candidates.find(c=>c.status==="open"&&!c.withinLimit);
  if(farOpen&&!shortlist.includes(farOpen)){if(shortlist.length===3)shortlist.pop();shortlist.push(farOpen);}
  await Promise.all(shortlist.map(async card=>{
    card.route=await routeFor(prefs,card.offer);
    Object.assign(card,assessVisit((hours.get(card.offer.shop_id) as {weekly_hours:string}|undefined)?.weekly_hours,prefs,card.route));
    card.outsideRadius=prefs.radiusKm!==null&&card.route.distanceKm>prefs.radiusKm;
    card.withinLimit=!card.outsideRadius||prefs.radiusMode==="preferred";
  }));
  shortlist.sort((a,b)=>rank(a)-rank(b));
  const hubs=shoppingAreas(s.query,prefs.location).slice(0,2).map((h,i)=>({...h,id:`area_${i}`,route:h.distance_km===null?null:estimatedRoute(h.distance_km,prefs.travelMode),status:"unknown" as const}));
  const open=shortlist.filter(c=>c.status==="open"&&c.withinLimit),unknown=shortlist.filter(c=>c.status==="unknown"&&c.withinLimit);
  const summary=open.length?"این گزینه طبق ساعت ثبت‌شده، پس از رسیدن فرصت خرید دارد. موجودی و قیمت نهایی را پیش از حرکت تأیید کنید.":unknown.length?"بازبودن گزینه‌های نزدیک تأیید نشده است. پیش از حرکت بررسی کنید؛ محدودهٔ خرید نزدیک هم روی نقشه مشخص است.":"در گزینه‌های بررسی‌شده، فروشگاه مناسبِ این زمان و محدوده پیدا نشد. زمان حرکت، وسیله یا محدوده را تغییر دهید؛ گزینه‌های جایگزین روی نقشه‌اند.";
  return {version:s.version,summary,shops:shortlist,hubs,examined:candidates.length,mode:prefs.travelMode||"walking",departureAt:prefs.departureAt||new Date().toISOString()};
}
export type ShoppingDecision=Awaited<ReturnType<typeof buildDecision>>;
