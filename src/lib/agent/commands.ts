import {normalizePersian} from "../normalize";
import type {ShoppingSession,CheckRecord} from "@/types/workflow";
import type {ShoppingOffer} from "../services/catalog";
type LocalCommand={answer:string}|{action:"check";offerId:string}|{action:"visit";checkId:string}|{action:"cancel_check"};
/** Only an explicit user message can request an action; seller/OCR text never enters here. */
export function localCommand(message:string,session:ShoppingSession,offers:ShoppingOffer[],check:CheckRecord|null):LocalCommand|null {
  const q=normalizePersian(message).replace(/[؟?!،.]/g,"").trim();
  if(/^(چه تغییر(?:ی کرد| کرد)?|چرا جایگزین شد|چه اتفاقی افتاد)$/.test(q)) {
    return {answer:session.events.slice().reverse().find(e=>e.action==="replan")?.message||"هنوز جایگزینی انجام نشده است. تغییر شروط و بررسی‌های فروشنده در بخش «چه اتفاقی افتاد؟» ثبت می‌شوند."};
  }
  if(/^(وضعیت بررسی|نتیجه بررسی|چی شد|چه شد)$/.test(q))return {answer:check?check.message:"هنوز فروشگاهی بررسی نشده؛ یک آفر را برای بررسی شبیه‌سازی‌شده انتخاب کنید."};
  if(/^(لغو کن|بررسی را لغو کن|انصراف از بررسی)$/.test(q)&&check?.status==="CHECKING")return {action:"cancel_check"};
  if(/^(کارت مراجعه|برنامه مراجعه|کارت مراجعه را بساز|برنامه مراجعه را بساز|بریم)$/.test(q)&&check&&["AVAILABLE","PRICE_CHANGED"].includes(check.status))return {action:"visit",checkId:check.id};
  if(session.selectedProductId&&/^(ارزان ترین(?: فروشگاه| گزینه)? را بررسی کن|ارزانترین(?: فروشگاه| گزینه)? را بررسی کن)$/.test(q)) {
    return offers[0]?{action:"check",offerId:offers[0].offer_id}:{answer:"با حفظ تمام شروط فعلی، آفر واجد شرایطی برای بررسی پیدا نشد؛ زمان نامعلوم را می‌توانید جداگانه از کارت فروشگاه بررسی کنید."};
  }
  if(session.selectedOfferId&&/^(بررسی کن|پیگیری کن|جایگزین را بررسی کن|فروشگاه بعدی را بررسی کن)$/.test(q))return {action:"check",offerId:session.selectedOfferId};
  if(/^(مقایسه کن|تفاوتشان چیست|تفاوت مدل ها|کدام بهتر است)$/.test(q)&&session.products.length)return {answer:session.products.map(p=>`${p.persian_title}: ${p.tradeoff_summary}`).join("\n\n")+"\nاین جمع‌بندی از مشخصات ثبت‌شده است؛ آزمون عملی یا نظر مشتری نیست."};
  return null;
}
