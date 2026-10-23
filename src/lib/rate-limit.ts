import {AppError} from "./validation";
const windows=new Map<string,{count:number;until:number}>();
/** Best-effort single-replica limits; this is not a distributed quota service. */
export function rateLimit(key:string,limit:number,windowMs=60_000) {
  const now=Date.now();
  if(windows.size>5000)for(const [k,v] of windows)if(v.until<now)windows.delete(k);
  const window=windows.get(key);
  if(!window||window.until<=now){windows.set(key,{count:1,until:now+windowMs});return;}
  if(window.count>=limit)throw new AppError("تعداد درخواست‌ها زیاد شده؛ یک دقیقه بعد دوباره تلاش کنید.",429,"RATE_LIMIT");
  window.count++;
}
