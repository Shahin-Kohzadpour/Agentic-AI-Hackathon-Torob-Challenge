import {getProductDetails} from "./catalog";
import {normalizePersian} from "../normalize";
import type {Preferences,ProductCandidate} from "@/types/workflow";

/** Explain only catalogue evidence. Presence of a specification is not a quality score. */
export function explainCandidates(products:ProductCandidate[],prefs:Preferences,exactModel:boolean) {
  const needs=normalizePersian([prefs.useCase,prefs.feature].filter(Boolean).join(" "));
  const pattern=/عکس|عکاسی|دوربین/.test(needs)?/دوربین|فیلم.?برداری|لرزشگیر/:
    /مکالمه|تماس/.test(needs)?/میکروف|مکالمه|نویز|حذف صدا/:
    /باتری|رفت.?و.?آمد|روزمره/.test(needs)?/باتری|شارژ|وزن|مقاوم/:
    /دانشجو|درس/.test(needs)?/پردازنده|حافظه|رم|وزن|باتری/:
    /ساده|والدین/.test(needs)?/صفحه|کلید|باتری|وزن/:null;
  const items=products.map((p,index)=>{
    const specs=getProductDetails(p.product_id)?.specs||[];
    const relevant=pattern?specs.filter(s=>pattern.test(s.key)&&s.value):[];
    const highlights=[...relevant,...p.highlight_specs.filter(s=>!relevant.some(r=>r.key===s.key))].slice(0,5);
    const evidence=relevant.slice(0,2).map(s=>`${s.key}: ${s.value.slice(0,180)}`).join("؛ ");
    return {product:{...p,highlight_specs:highlights,tradeoff_summary:needs?(evidence?`برای بررسی نیاز «${[prefs.useCase,prefs.feature].filter(Boolean).join("، ")}»، این مشخصات ثبت شده‌اند: ${evidence}. کیفیت عملی از روی این داده تضمین نمی‌شود.`:`برای نیاز «${prefs.useCase||prefs.feature}» مشخصات کافی ثبت نشده؛ پیش از انتخاب بررسی بیشتری لازم است.`):p.tradeoff_summary},score:exactModel?0:relevant.length,index};
  });
  if(pattern&&!exactModel)items.sort((a,b)=>b.score-a.score||a.index-b.index);
  const seen=new Set<string>();
  return items.filter(({product:p})=>{
    if(exactModel)return true;
    const key=normalizePersian(p.model||p.persian_title).replace(/سفید|مشکی|نقره ای|آبی|قرمز/g,"").trim();
    if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,3).map(x=>x.product);
}
