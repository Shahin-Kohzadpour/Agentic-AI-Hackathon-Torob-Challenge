import { normalizePersian } from "../normalize";
import type { Preferences } from "@/types/workflow";

/** Only explicit user text may change journey constraints. */
export function journeyFromText(message:string, now=new Date()):Partial<Preferences> {
  const s=normalizePersian(message), patch:Partial<Preferences>={};
  if(/پیاده/.test(s))patch.travelMode="walking";
  if(/ماشین|خودرو|تاکسی|اسنپ|رانندگی/.test(s))patch.travelMode="driving";
  const radius=s.match(/(\d+(?:[.٫]\d+)?)\s*(?:کیلومتر|km)/);
  if(radius&&/شعاع|فاصله|راه|بیشتر|بیش از|نزدیک|محدوده|ترجیح|حداکثر/.test(s)) {
    patch.radiusKm=Number(radius[1].replace("٫","."));
    patch.radiusMode=/ترجیح|بهتره|بهتر است/.test(s)?"preferred":"hard";
  }
  if(/بدون محدودیت (?:فاصله|محدوده)|محدوده را بردار|شعاع را بردار/.test(s))patch.radiusKm=null;
  if(/همین (?:الان|امشب)|امشب|فوری|الان|ساعت|فردا|امروز/.test(s)) {
    patch.urgent=true;
    const date=new Date(now.getTime()+(/فردا/.test(s)?86400000:0));
    let local=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
    const clock=s.match(/(?:ساعت\s*)?(\d{1,2})\s*[:：]\s*(\d{2})/)||s.match(/ساعت\s*(\d{1,2})(?:\s*(?:و\s*)?(نیم))?/);
    if(clock) {
      let hour=Number(clock[1]);const minute=clock[2]==="نیم"?30:Number(clock[2]||0);
      if(/شب|عصر|بعدازظهر|بعد از ظهر/.test(s)&&hour<12)hour+=12;
      if(/صبح/.test(s)&&hour===12)hour=0;
      if(/شب/.test(s)&&hour===12){hour=0;local=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(date.getTime()+86400000));}
      if(hour<=23&&minute<=59)patch.departureAt=`${local}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00+03:30`;
    } else if(/الان|امشب|امروز|فوری/.test(s))patch.departureAt=now.toISOString();
    else if(/فردا/.test(s))patch.departureAt=`${local}T10:00:00+03:30`;
  }
  return patch;
}

export function isJourneyFollowup(message:string,hasQuery:boolean) {
  if(!hasQuery)return false;
  const s=normalizePersian(message);
  const journey=/پیاده|ماشین|خودرو|تاکسی|اسنپ|رانندگی|ساعت|فردا|امشب|نقشه|محدوده|کیلومتر|بسته شود|تا رسیدن|جایگزین|همان|همون|بودجه|میلیون|تومان|قسط|ترب پی/.test(s);
  const newItem=(/شارژر|کابل|گوشی|هندزفری|هدفون|کفش|لپ.?تاپ|یخچال|تلویزیون|دوربین/.test(s)||/[a-z]+\d/i.test(s))&&!/همان|همون/.test(s);
  return journey&&!newItem;
}

export function productPhrase(message:string):string|null {
  const s=normalizePersian(message);
  if(!/شارژر/.test(s))return null;
  const model=s.match(/\b(?:ep[- ]?(?:ta|t)\d+[a-z]*|a\d{3,5})\b/i)?.[0];
  return ["شارژر",/سامسونگ|samsung/.test(s)?"سامسونگ":/آیفون|ایفون|iphone|اپل/.test(s)?"آیفون":"",model||"",/خودرو|فندکی/.test(s)?"فندکی":""].filter(Boolean).join(" ");
}
