import { getDatabase } from "../db";
import { normalizePersian } from "../normalize";
import { calculateDistanceKm, extractAddressFloorUnit } from "../geo";
import { hoursEvidence, paymentEvidence, parseJson, warrantySummary } from "../policy";
import { getLiveTrafficRoute, getBatchDistanceMatrix, getStoreLocationContext } from "./neshan";
import type { Product, EligibleOfferResult } from "@/types/dataset";
import type { ProductCandidate, Preferences } from "@/types/workflow";

let statisticsAvailable:boolean|undefined;
const STOP=new Set("اقتصادی ارزان گران بهترین خوب جدید قدیمی قیمت مناسب پرچمدار میانرده میان رده برای مدل نوع حدود تا تومان تومن میلیون میلیونی پیشنهاد معرفی بده داری چیا چی میخوام می خواهم میخواهم لطفا سلام درود خرید حضوری تهران کمکم کن دنبال هستم باشه داشته باشند یک یه با بدون بودجه بودجهام است و در از به را نزدیک نزدیکترین فروشگاه رفت آمد رفتوآمد کیفیت باکیفیت لازم دارم کجاست کجا کنم امکان ترب پی قسطی اقساطی حتما پرداخت".split(/\s+/));
const ALIASES:Record<string,string>={anker:"انکر",samsung:"سامسونگ",xiaomi:"شیائومی",earbuds:"هندزفری",headphones:"هدفون",iphone:"آیفون",laptop:"لپ تاپ", "ایرپاد":"هندزفری", "کتونی":"کفش"};
type Raw=Record<string,unknown> & {product_id:string;persian_title:string;category_name:string};
export function queryWords(query:string):string[] {
  let normalized=normalizePersian(query).replace(/\b([as])\s+(\d{2})\b/g,"$1$2").replace(/\d+(?:[٫.,]\d+)?\s*(?:میلیون|هزار|تومان|تومن)/g," ").replace(/[^\p{L}\p{N}\s-]/gu," ");
  for(const [from,to] of Object.entries(ALIASES)) normalized=normalized.replace(new RegExp(`(?<![\\p{L}\\p{N}])${from}(?![\\p{L}\\p{N}])`,"gu"),to);
  return [...new Set(normalized.split(/\s+/).filter(w=>(w.length>=2||w==='c')&&!STOP.has(w)&&(!/^\d+$/.test(w)||Number(w)<2000)))].slice(0,12);
}
function candidate(row:Raw):ProductCandidate {
  const specs=parseJson<Array<{key:string;value:string}>>(row.specs,[]), images=parseJson<string[]>(row.image_urls,[]);
  const valid=Array.isArray(specs)?specs.filter(s=>s&&s.key&&s.value):[];
  const useful=valid.filter(s=>!/^(رنگ|برند|مدل)$/.test(s.key));
  const highlights=(useful.length?useful:valid).slice(0,5);
  return {product_id:row.product_id,persian_title:row.persian_title||"عنوان محصول ثبت نشده",brand_name:row.brand_name?String(row.brand_name):null,category_name:row.category_name,model:row.model?String(row.model):null,image_url:Array.isArray(images)&&images[0]?`/api/product-image?productId=${encodeURIComponent(row.product_id)}`:null,min_price_toman:typeof row.min_price==="number"?row.min_price:null,distinct_sellers:Number(row.seller_count||0),highlight_specs:highlights,tradeoff_summary:highlights.length?highlights.slice(0,2).map(s=>`${s.key}: ${s.value}`).join("؛ "):"مشخصات کافی برای مقایسه ثبت نشده؛ عنوان و شرایط آفر را بررسی کنید."};
}
export function searchProducts(query:string,category?:string|null,maxBudget?:number|null,limit=3):ProductCandidate[] {
  const db=getDatabase(),words=queryWords(query);
  if(!words.length) return [];
  const safeLimit=Math.min(60,Math.max(1,Math.trunc(limit)||3));
  const models=words.filter(w=>/[a-z]/i.test(w)&&/\d/.test(w));
  const categoryTerms=words.filter(w=>/^(هدفون|هندزفری|گوشی|موبایل|لپ|تاپ|کفش|تلویزیون|یخچال|دوربین|کابل|اسپیکر)$/.test(w));
  const equivalent:Record<string,string[]>={"آیفون":["آیفون","ایفون","iphone"],iphone:["آیفون","ایفون","iphone"],"انکر":["انکر","anker"],"سامسونگ":["سامسونگ","samsung"],"شیائومی":["شیائومی","xiaomi"]};
  const fts=(tokens:string[],op=" ")=>tokens.map(w=>{const values=equivalent[w]||[w];const expression=values.map(v=>`"${v.replace(/"/g,"")}"*`).join(" OR ");return values.length>1?`(${expression})`:expression}).join(op);
  const selectors=models.length?[fts(models),fts(models.flatMap(m=>{const split=m.match(/^([a-z]+)(\d+)$/i);return split?[split[1],split[2]]:[m]}))]:[fts(words),...(categoryTerms.length?[fts(categoryTerms," OR ")]:[]),fts(words," OR ")];
  const normalizedQuery=normalizePersian(query),wantsNC=/\bnc\b/i.test(normalizedQuery);
  const head=queryWords(normalizedQuery.split(/\s+برای\s+/)[0]).join(" ");
  const accessory=/^(باتری|کاور|قاب|گلس|کیف|کابل|محافظ|شارژر|پایه|بند|لنز|اسپری|واکس|فیلتر|درب|فلت|تاچ|ال سی دی|lcd|کنترل|ریموت|مادربرد|کیبورد|دوربین گوشی|دوربین آیفون)(?:\s|$)/.test(head);
  const wantsAccessory=accessory;
  const mainPhone=!accessory&&(/گوشی|موبایل|آیفون|ایفون|iphone|galaxy|redmi/.test(normalizedQuery)||/\b[sa]\d{2}\b/.test(normalizedQuery));
  const mainHeadphone=!accessory&&/هدفون|هندزفری|ایرپاد|\br50i\b|\bqcy\b/.test(normalizedQuery);
  const mainLaptop=!accessory&&/لپ.?تاپ|لپ تاپ|laptop|macbook|نوت.?بوک/.test(normalizedQuery);
  const mainShoe=!accessory&&/کفش|کتونی/.test(normalizedQuery);
  const mainFridge=!accessory&&/یخچال/.test(normalizedQuery);
  const mainTV=!accessory&&/تلویزیون/.test(normalizedQuery);
  const mainCamera=!accessory&&!mainPhone&&/دوربین|canon|کانن/.test(normalizedQuery);
  const capacity=normalizedQuery.match(/\b(64|128|256|512|1024)\b/)?.[1];
  const variants=words.filter(w=>/^(fe|nc|ultra|pro|max|plus|mini)$/.test(w));
  if(statisticsAvailable===undefined)statisticsAvailable=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name='product_stats'").get());
  const minExpression=statisticsAvailable?"ps.min_price":"(SELECT MIN(price_toman) FROM offers o WHERE o.product_id=p.product_id AND price_toman>0 AND price_toman=CAST(price_toman AS INTEGER))";
  const countExpression=statisticsAvailable?"ps.seller_count":"(SELECT COUNT(DISTINCT shop_id) FROM offers o WHERE o.product_id=p.product_id)";
  const join=statisticsAvailable?"LEFT JOIN product_stats ps ON ps.product_id=p.product_id":"";
  const typeFilter=mainPhone?"p.category_name LIKE 'گوشی%'":mainLaptop?"p.category_name LIKE 'لپ%'":mainFridge?"(p.category_name LIKE 'یخچال%' OR p.category_name LIKE 'فریزر%')":mainTV?"p.category_name LIKE 'تلویزیون%'":mainCamera?"p.category_name LIKE 'دوربین%'":mainShoe?"p.category_name LIKE '%کفش%'":mainHeadphone?"(p.category_name LIKE '%هدفون%' OR p.category_name LIKE '%هندزفری%')":"";
  let rows:Raw[]=[];
  for(const expression of [...new Set(selectors)]) {
    try {
      rows=db.prepare(`SELECT p.product_id,p.persian_title,p.brand_name,p.category_name,p.model,${minExpression} AS min_price,${countExpression} AS seller_count
        FROM products_fts JOIN products p ON p.product_id=products_fts.product_id ${join} WHERE products_fts MATCH ?
        ${typeFilter?`AND ${typeFilter}`:""} ${maxBudget!==undefined&&maxBudget!==null?`AND ${minExpression}<=?`:""} ORDER BY rank LIMIT 1200`).all(...(maxBudget!==undefined&&maxBudget!==null?[expression,maxBudget]:[expression])) as unknown as Raw[];
    } catch {rows=[];}
    if(rows.length) break;
  }
  rows=rows.filter(r=>{
    const title=normalizePersian(r.persian_title),cat=normalizePersian(r.category_name);
    if(models.length&&!models.every(m=>title.replace(/[\s_-]/g,"").includes(m.replace(/[\s_-]/g,""))||normalizePersian(String(r.model||"")).replace(/[\s_-]/g,"").includes(m))) return false;
    if(wantsNC&&!/\bnc\b/.test(title)) return false;
    if(capacity&&!new RegExp(`\\b${capacity}\\b`).test(title)) return false;
    if(variants.some(v=>!new RegExp(`\\b${v}\\b`).test(title))) return false;
    if(category&&!cat.includes(normalizePersian(category))) return false;
    if(!wantsAccessory&&/کیف و کاور|باتری گوشی|محافظ صفحه|تاچ و ال سی دی|کاور میکروفون|پایه نگهدارنده/.test(cat)) return false;
    if(!wantsAccessory&&/^(باتری|کاور|قاب|گلس|شارژر|تاچ|ال سی دی|کیف|پایه)\s/.test(title)) return false;
    if(mainPhone&&!/^گوشی/.test(cat))return false;
    if(mainHeadphone&&!/هدفون|هندزفری/.test(cat))return false;
    if(mainLaptop&&!/^(لپ|نوت)/.test(cat))return false;
    if(mainShoe&&(!/(^|\s)کفش(?:\s|$)|کتانی|کتونی/.test(cat)||/لوازم|واکس|اسپری|جاکفشی|جا کفشی|کفی|بند|بوگیر|خشک کن|کفشور/.test(cat)||!/کفش\s|کتانی|کتونی/.test(title)))return false;
    if(mainShoe&&/کتونی|کتانی/.test(normalizedQuery)&&!/کتانی|کتونی|اسپرت/.test(cat))return false;
    if(mainFridge&&!/^(یخچال|فریزر)/.test(cat))return false;
    if(mainTV&&!/^تلویزیون/.test(cat))return false;
    if(mainCamera&&!/^دوربین/.test(cat))return false;
    if(!wantsAccessory&&/لنز|فلت|درب پشت|اسپری|واکس|فیلتر|لوازم جانبی|جاکفشی|جا کفشی/.test(cat))return false;
    if(/usb[\s-]*c|تایپ[\s-]*سی/.test(normalizedQuery)&&!(/usb[\s-]*c|type[\s-]*c|تایپ[\s-]*سی/.test(title)))return false;
    if(categoryTerms.some(w=>w==="هدفون"||w==="هندزفری")&&!/هدفون|هندزفری/.test(cat)) return false;
    if(maxBudget!==undefined&&maxBudget!==null&&(!(typeof r.min_price==="number")||r.min_price>maxBudget)) return false;
    return true;
  });
  function score(r:Raw) {
    const title=normalizePersian(r.persian_title),cat=normalizePersian(r.category_name);
    return words.reduce((sum,w)=>sum+(title.includes(w)?25:0)+(cat.includes(w)?35:0),0)+models.reduce((sum,m)=>sum+(title.includes(m)?150:0),0)+(!wantsNC&&models.some(m=>m.startsWith("r50i"))&&!/\bnc\b/.test(title)?150:0)+Math.min(Number(r.seller_count||0),60)+(title.includes(normalizePersian(query))?100:0)-((mainPhone&&words.some(w=>/^\d{1,2}$/.test(w))&&!variants.length&&/\b(pro|max|plus|ultra|mini)\b|پرو|مکس|پلاس|الترا|مینی/.test(title))?200:0)-(!/پک|بسته|عمده/.test(normalizedQuery)&&/پک|بسته .*عدد/.test(title)?200:0);
  }
  rows.sort((a,b)=>score(b)-score(a)||Number(b.seller_count)-Number(a.seller_count)||Number(a.min_price||Infinity)-Number(b.min_price||Infinity));
  const details=db.prepare("SELECT specs,image_urls FROM products WHERE product_id=?");
  return rows.slice(0,safeLimit).map(row=>candidate({...row,...details.get(row.product_id)}));
}
export function getProductDetails(id:string):Product|null {
  const row=getDatabase().prepare("SELECT * FROM products WHERE product_id=?").get(id) as Raw|undefined;
  if(!row) return null;
  return {product_id:row.product_id,persian_title:row.persian_title,brand_name:row.brand_name?String(row.brand_name):null,category_name:row.category_name,model:row.model?String(row.model):null,image_urls:parseJson(row.image_urls,[]),specs:parseJson(row.specs,[])};
}
export function productCandidate(id:string):ProductCandidate|null {
  const row=getDatabase().prepare(`SELECT p.*, (SELECT MIN(price_toman) FROM offers WHERE product_id=p.product_id AND price_toman>0) min_price,(SELECT COUNT(DISTINCT shop_id) FROM offers WHERE product_id=p.product_id) seller_count FROM products p WHERE product_id=?`).get(id) as Raw|undefined;
  return row?candidate(row):null;
}
export interface ShoppingOffer extends EligibleOfferResult {
  hours_status:"unknown"|"open_declared"|"closed_declared";
  payment_summary:string; warranty_summary:string; category_name:string;
  shop_name_is_anonymized:boolean; source_url:string|null;
  source_mode:"dataset"; availability:"listed_offer"; exclusion_reasons:string[];
}
export function offersForProduct(productId:string,prefs:Preferences,includeExcluded=false):ShoppingOffer[] {
  const rows=getDatabase().prepare(`SELECT o.*,s.name shop_name,s.location_label,s.address,s.lat,s.lon,s.weekly_hours,s.payment_options,s.website_url,s.instagram,p.category_name FROM offers o JOIN shops s ON s.shop_id=o.shop_id JOIN products p ON p.product_id=o.product_id WHERE o.product_id=? ORDER BY o.price_toman ASC`).all(productId) as Array<Record<string,unknown>>;
  const offers:ShoppingOffer[]=[];
  for(const row of rows) {
    const price=Number(row.price_toman);
    if(row.price_toman===null||!Number.isSafeInteger(price)||price<=0) continue;
    const lat=typeof row.lat==="number"?row.lat:null,lon=typeof row.lon==="number"?row.lon:null;
    const distance=calculateDistanceKm(prefs.location.lat,prefs.location.lon,lat,lon),hours=hoursEvidence(row.weekly_hours,prefs.arrivalAt),payment=paymentEvidence(row.payment_options,price,String(row.category_name));
    const reasons:string[]=[];
    if(prefs.budget!==null&&price>prefs.budget) reasons.push("بالاتر از سقف بودجه");
    if(prefs.payment==="torobpay"&&!payment.eligible) reasons.push(payment.summary);
    if(prefs.radiusKm!==null&&(distance===null||distance>prefs.radiusKm)) reasons.push(distance===null?"فاصله نامعلوم":"خارج از شعاع انتخابی");
    if(prefs.requireOpen&&hours.status!=="open_declared") reasons.push(hours.status==="unknown"?"ساعت مراجعه احراز نشده":"در زمان مراجعه و بافر ۲۰ دقیقه باز نیست");
    if(reasons.length&&!includeExcluded) continue;
    offers.push({offer_id:String(row.offer_id),product_id:String(row.product_id),shop_id:String(row.shop_id),shop_name:String(row.shop_name),location_label:row.location_label?String(row.location_label):null,address:row.address?String(row.address):null,lat,lon,seller_title:String(row.seller_title),price_toman:price,last_price_changed_at:row.last_price_changed_at?String(row.last_price_changed_at):null,warranty:row.warranty?String(row.warranty):null,description:row.description?String(row.description):null,has_torob_pay_in_person:payment.eligible,distance_km:distance===null?null:Math.round(distance*100)/100,weekly_hours_summary:hours.summary,floor_unit:extractAddressFloorUnit(row.address?String(row.address):null),hours_status:hours.status,payment_summary:payment.summary,warranty_summary:warrantySummary(row.warranty?String(row.warranty):null),category_name:String(row.category_name),shop_name_is_anonymized:![row.website_url,row.instagram].some(v=>typeof v==="string"&&v.trim()&&v!=="null"),source_url:typeof row.website_url==="string"&&/^https?:\/\//i.test(row.website_url)?row.website_url:null,source_mode:"dataset",availability:"listed_offer",exclusion_reasons:reasons});
  }
  return offers;
}
export function getOffer(offerId:string,prefs:Preferences):ShoppingOffer|null {
  const row=getDatabase().prepare("SELECT product_id FROM offers WHERE offer_id=?").get(offerId) as {product_id:string}|undefined;
  return row?offersForProduct(row.product_id,prefs,true).find(o=>o.offer_id===offerId)||null:null;
}
export function findEligibleOffers(productId:string,userLat=35.6948,userLon=51.4089,maxDistanceKm:number|null=null,maxBudget:number|null=null,torobPayOnly=false):EligibleOfferResult[] {
  return offersForProduct(productId,{budget:maxBudget,payment:torobPayOnly?"torobpay":"any",location:{lat:userLat,lon:userLon,label:"مبدأ انتخابی"},radiusKm:maxDistanceKm,arrivalAt:null,requireOpen:false,useCase:null,feature:null});
}
export async function attachLiveTrafficToOffers<T extends EligibleOfferResult>(offers:T[],userLat=35.6948,userLon=51.4089):Promise<T[]> {
  const destinations=offers.slice(0,3).filter(o=>o.lat!==null&&o.lon!==null);
  if(!destinations.length) return offers;
  const [matrix,route,context]=await Promise.all([getBatchDistanceMatrix(userLat,userLon,destinations.map(o=>({lat:o.lat!,lon:o.lon!}))),getLiveTrafficRoute(userLat,userLon,destinations[0].lat!,destinations[0].lon!),getStoreLocationContext(destinations[0].lat!,destinations[0].lon!)]);
  destinations.forEach((offer,index)=>{const value=matrix[index];if(value) offer.live_eta={driving_distance_km:value.distance_km,duration_minutes:value.duration_minutes,traffic_summary:"برآورد نشان",eta_formatted:`${value.duration_minutes} دقیقه (برآورد نشان)`};});
  if(route) destinations[0].live_eta={driving_distance_km:route.distance_km,duration_minutes:route.duration_minutes,traffic_summary:route.traffic_summary,eta_formatted:route.eta_formatted};
  if(context) destinations[0].traffic_zone={in_traffic_zone:context.in_traffic_zone,in_odd_even_zone:context.in_odd_even_zone,neighbourhood:context.neighbourhood};
  return offers;
}
