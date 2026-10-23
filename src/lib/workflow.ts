import {localCommand} from "./agent/commands";
import { randomUUID } from "node:crypto";
import { getProductDetails, productCandidate, searchProducts, offersForProduct, getOffer } from "./services/catalog";
import { addEvent, addMessage, allChecks, loadSession, putCheck, readCheck, saveSession, transaction } from "./session";
import { preferencesFromText, understandRequest, parseBudget } from "./agent/client";
import { validatePreferences } from "./policy";
import { AppError, identifier, object, text } from "./validation";
import {explainCandidates} from "./services/recommendations";
import { shoppingAreas } from "./services/areas";
import type { ShoppingSession, CheckRecord, CheckOutcome, Scenario } from "@/types/workflow";
import {simulatedOutcome,simulatedPrice,SIMULATION_MESSAGES} from "./services/seller-simulator";

const OUTCOMES:CheckOutcome[]=["AVAILABLE","NO_ANSWER","OUT_OF_STOCK","PRICE_CHANGED","CLOSING","AMBIGUOUS_VARIANT"];
function searchWithPreferences(session:ShoppingSession,query:string) {
  const products=searchProducts(query,null,session.preferences.budget,60).flatMap(product=>{
    const eligible=offersForProduct(product.product_id,session.preferences);
    const conditional=!eligible.length&&session.preferences.requireOpen?offersForProduct(product.product_id,session.preferences,true).filter(o=>o.exclusion_reasons.length===1&&o.hours_status==="unknown"):[];
    const candidates=eligible.length?eligible:conditional;
    if(!candidates.length) return [];
    return [{...product,min_price_toman:Math.min(...candidates.map(o=>o.price_toman)),distinct_sellers:new Set(candidates.map(o=>o.shop_id)).size,needs_hours_verification:!eligible.length}];
  });
  return explainCandidates(products,session.preferences,/[a-z]+\d/i.test(query));
}
function failedIds(session:ShoppingSession) {
  const latest=new Map<string,CheckRecord>();
  for(const check of allChecks(session.id))if(check.productId===session.selectedProductId&&check.preferencesHash===JSON.stringify(session.preferences)&&!["CHECKING","CANCELLED"].includes(check.status))latest.set(check.shopId,check);
  return new Set([...latest.values()].filter(c=>["NO_ANSWER","OUT_OF_STOCK","CLOSING"].includes(c.status)||(c.status==="PRICE_CHANGED"&&session.preferences.budget!==null&&c.observedPrice!==null&&c.observedPrice>session.preferences.budget)).map(c=>c.shopId));
}
export function currentOffers(session:ShoppingSession,includeExcluded=false) {
  if(!session.selectedProductId) return [];
  const failed=failedIds(session);
  return offersForProduct(session.selectedProductId,session.preferences,includeExcluded).filter(o=>!failed.has(o.shop_id));
}
function completeCheck(session:ShoppingSession):ShoppingSession {
  if(!session.activeCheckId) return session;
  const check=readCheck(session.id,session.activeCheckId);
  if(!check||check.status!=="CHECKING"||Date.now()<Date.parse(check.readyAt)) return session;
  if(check.preferencesHash!==JSON.stringify(session.preferences)||check.productId!==session.selectedProductId||check.offerId!==session.selectedOfferId) {check.status="CANCELLED";putCheck(check);return session;}
  check.status=check.outcome;check.observedAt=new Date().toISOString();
  const offer=getOffer(check.offerId,session.preferences);
  if(!offer) {check.status="CANCELLED";putCheck(check);return session;}
  check.observedPrice=simulatedPrice(offer.price_toman,check.outcome);
  check.message=SIMULATION_MESSAGES[check.outcome];
  check.arrivalConfirmed=check.arrivalAt&&check.verifyUnknownHours&&["AVAILABLE","PRICE_CHANGED"].includes(check.outcome)?true:check.outcome==="CLOSING"?false:null;
  if(check.arrivalConfirmed)check.message+=" در همین شبیه‌سازی، مناسب‌بودن زمان مراجعهٔ انتخاب‌شده هم اعلام شد.";
  putCheck(check);
  addEvent(session,"seller_check_completed",check.message,offer.offer_id,"simulation");
  if(["NO_ANSWER","OUT_OF_STOCK","CLOSING"].includes(check.status)||(check.status==="PRICE_CHANGED"&&session.preferences.budget!==null&&check.observedPrice!>session.preferences.budget)) {
    const candidates=offersForProduct(offer.product_id,session.preferences).filter(o=>o.shop_id!==offer.shop_id&&!failedIds(session).has(o.shop_id));
    session.selectedOfferId=candidates[0]?.offer_id||null;session.stage="stores";
    const next=candidates[0],previousPrice=check.observedPrice??offer.price_toman;
    const priceDifference=next?next.price_toman-previousPrice:0;
    const distanceDifference=next?.distance_km!==null&&next?.distance_km!==undefined&&offer.distance_km!==null?next.distance_km-offer.distance_km:null;
    const changes=next?[priceDifference?`قیمت ${Math.abs(priceDifference).toLocaleString("fa-IR")} تومان ${priceDifference>0?"بیشتر":"کمتر"} از ${check.observedPrice?"پاسخ شبیه‌سازی‌شده":"قیمت ثبت‌شدهٔ قبلی"} است.`:"قیمت ثبت‌شده برابر است.",distanceDifference===null?"فاصلهٔ قابل مقایسه ثبت نشده.":`فاصلهٔ هوایی ${Math.abs(distanceDifference).toLocaleString("fa-IR",{maximumFractionDigits:2})} کیلومتر ${distanceDifference>=0?"بیشتر":"کمتر"} است.`,offer.warranty_summary!==next.warranty_summary?`گارانتی قبلی: ${offer.warranty_summary}؛ جایگزین: ${next.warranty_summary}.`:"اطلاعات گارانتی ثبت‌شده یکسان است."].join(" "):"";
    const explanation=next?`فروشگاه «${offer.shop_name}» مناسب مراجعه نشد. آفر ثبت‌شدهٔ «${next.shop_name}» با قیمت ${next.price_toman.toLocaleString("fa-IR")} تومان و همان شروط پیشنهاد می‌شود. ${changes}`:"با حفظ تمام شروط، فروشگاه جایگزین پیدا نشد. فقط با انتخاب شما می‌توان شرطی را تغییر داد.";
    addEvent(session,"replan",explanation,session.selectedOfferId||undefined);
    addMessage(session,"assistant",explanation);
  } else if(check.status==="AMBIGUOUS_VARIANT") {session.stage="stores";addMessage(session,"assistant","عنوان دقیق فروشنده، رنگ و گارانتی را در کارت مقایسه کنید؛ برای مدل متفاوت، انتخاب تازه لازم است.");}
  else {session.stage="checking";addMessage(session,"assistant",check.message);}
  return saveSession(session,session.version);
}
function buildSnapshot(session:ShoppingSession) {
  session=completeCheck(session);
  const offers=currentOffers(session),all=session.selectedProductId?offersForProduct(session.selectedProductId,session.preferences,true):[];
  const activeCheck=session.activeCheckId?readCheck(session.id,session.activeCheckId):null;
  const checkedOffer=activeCheck?getOffer(activeCheck.offerId,session.preferences):null;
  const visitCheck=session.visitCheckId?readCheck(session.id,session.visitCheckId):null;
  const visitOffer=visitCheck?getOffer(visitCheck.offerId,session.preferences):null;
  const backup=visitOffer?offers.find(o=>o.shop_id!==visitOffer.shop_id):null;
  return {session,offers,excludedCount:all.filter(o=>o.exclusion_reasons.length).length,exclusionReasons:[...new Set(all.flatMap(o=>o.exclusion_reasons))],unknownHourOffers:session.preferences.requireOpen?all.filter(o=>o.exclusion_reasons.length===1&&o.hours_status==="unknown"):[],activeCheck,checkedOffer,visit:visitCheck&&visitOffer?{check:visitCheck,offer:visitOffer,backup:backup||null}:null,hubs:session.stage==="empty"?shoppingAreas(session.query):[],selectedProduct:session.selectedProductId?productCandidate(session.selectedProductId):null};
}
export function snapshot(session:ShoppingSession) {return transaction(()=>buildSnapshot(session));}
export type WorkflowSnapshot=ReturnType<typeof snapshot>;
function invalidate(session:ShoppingSession) {
  if(session.activeCheckId) {const check=readCheck(session.id,session.activeCheckId);if(check?.status==="CHECKING"){check.status="CANCELLED";putCheck(check);}}
  session.activeCheckId=null;session.visitCheckId=null;session.selectedOfferId=null;
}
export function startCheck(session:ShoppingSession,offerId:string,verifyUnknownHours=false) {
  const offer=getOffer(offerId,session.preferences);
  if(!offer||offer.product_id!==session.selectedProductId) throw new AppError("این آفر متعلق به محصول انتخاب‌شده نیست.",404,"OFFER_NOT_FOUND");
  const reasons=offer.exclusion_reasons.filter(r=>!(verifyUnknownHours&&r==="ساعت مراجعه احراز نشده"));
  if(reasons.length) throw new AppError(`این آفر واجد شرایط نیست: ${reasons.join("، ")}`);
  const outcome=simulatedOutcome(offer,session.scenario);
  const now=new Date();
  const check:CheckRecord={id:`check_${randomUUID()}`,sessionId:session.id,version:session.version,offerId:offer.offer_id,productId:offer.product_id,shopId:offer.shop_id,status:"CHECKING",outcome,startedAt:now.toISOString(),readyAt:new Date(now.getTime()+1800).toISOString(),observedAt:null,observedPrice:null,message:"در حال اجرای سناریوی شبیه‌سازی‌شدهٔ فروشنده؛ تماس واقعی برقرار نمی‌شود.",source:"simulation",arrivalAt:session.preferences.arrivalAt};
  check.preferencesHash=JSON.stringify(session.preferences);
  check.verifyUnknownHours=verifyUnknownHours;check.arrivalConfirmed=null;
  putCheck(check);session.selectedOfferId=offerId;session.activeCheckId=check.id;session.visitCheckId=null;session.stage="checking";
  addEvent(session,"seller_check_started",`بررسی شبیه‌سازی‌شدهٔ آفر ثبت‌شدهٔ ${offer.shop_name} آغاز شد.`,offerId,"simulation");
}
function actSync(session:ShoppingSession,input:unknown):WorkflowSnapshot {
  const body=object(input),action=text(body.action,40),oldVersion=session.version;
  if(action!=="reset"&&body.version!==oldVersion) throw new AppError("این صفحه قدیمی است؛ آخرین وضعیت بارگذاری می‌شود.",409,"STALE_VERSION");
  session.version++;
  if(action==="reset") {
    invalidate(session);
    saveSession(session,oldVersion);
    return snapshot(loadSession());
  }
  if(action==="preferences") {
    session.preferences=validatePreferences(object(body.preferences),session.preferences);
    invalidate(session);session.stage=session.selectedProductId?"stores":"discover";
    if(!session.selectedProductId&&session.query){session.products=searchWithPreferences(session,session.query);session.stage=session.products.length?"products":"empty";}
    addEvent(session,"preferences_changed","شرایط خرید با انتخاب شما تغییر کرد؛ نتایج و بررسی‌های وابسته دوباره محاسبه شدند.");
  } else if(action==="select_product") {
    const id=identifier(body.productId,"product"),product=getProductDetails(id);
    if(!product||!session.products.some(p=>p.product_id===id)) throw new AppError("محصول را از نتایج معتبر همین جلسه انتخاب کنید.",404);
    invalidate(session);session.selectedProductId=id;session.stage="stores";
    addMessage(session,"user",`محصول «${product.persian_title}» را انتخاب کردم.`);
    addMessage(session,"assistant","آفرهای ثبت‌شده با شروط فعلی بررسی شدند. ثبت آفر به معنی موجودی زنده نیست؛ عنوان دقیق و گارانتی هر فروشنده را مقایسه کنید.");
    addEvent(session,"find_offers","آفرهای محصول انتخاب‌شده با حفظ بودجه، مکان و پرداخت بازیابی شدند.");
  } else if(action==="check") {invalidate(session);startCheck(session,identifier(body.offerId,"offer"),body.verifyUnknownHours===true);}
  else if(action==="cancel_check") {invalidate(session);session.stage="stores";addEvent(session,"cancelled","بررسی لغو شد؛ پاسخ دیررس مجاز به تغییر انتخاب شما نیست.");}
  else if(action==="scenario") {
    if(body.scenario!=="AUTO"&&!OUTCOMES.includes(body.scenario as CheckOutcome)) throw new AppError("سناریوی شبیه‌ساز معتبر نیست.");
    session.scenario=body.scenario as Scenario;
    invalidate(session);session.stage=session.selectedProductId?"stores":"discover";
    addEvent(session,"scenario_changed","سناریوی نمایشی فقط برای همین جلسه تغییر کرد.",undefined,"simulation");
  } else if(action==="visit") {
    const id=identifier(body.checkId,"check"),check=readCheck(session.id,id);
    if(!check||!["AVAILABLE","PRICE_CHANGED"].includes(check.status)||check.id!==session.activeCheckId||check.preferencesHash!==JSON.stringify(session.preferences)||check.offerId!==session.selectedOfferId) throw new AppError("برای این آفر، بررسی معتبر و سازگار با شرایط فعلی وجود ندارد.");
    const offer=getOffer(check.offerId,session.preferences);
    if(!offer||offer.product_id!==session.selectedProductId) throw new AppError("آفر معتبر نیست.");
    const otherReasons=offer.exclusion_reasons.filter(r=>r!=="ساعت مراجعه احراز نشده");
    if(session.preferences.requireOpen&&offer.hours_status==="unknown"&&check.arrivalConfirmed!==true) throw new AppError("ساعت مراجعه هنوز بررسی نشده است.");
    if(otherReasons.length||!check.observedPrice||(session.preferences.budget!==null&&check.observedPrice>session.preferences.budget)||check.arrivalAt!==session.preferences.arrivalAt) throw new AppError("شرایط آفر با مراجعهٔ فعلی سازگار نیست؛ دوباره بررسی کنید.");
    session.visitCheckId=id;session.stage="visit";
    addEvent(session,"visit_plan_created","کارت مراجعه از آفر ثبت‌شدهٔ و پاسخ شبیه‌سازی‌شده ساخته شد؛ موجودی رزرو نشده است.",offer.offer_id,"simulation");
  } else throw new AppError("عملیات شناخته‌شده نیست.");
  saveSession(session,oldVersion);return snapshot(session);
}

export async function act(session:ShoppingSession,input:unknown):Promise<WorkflowSnapshot> {
  const body=object(input);
  if(body.action!=="chat") return transaction(()=>actSync(body.action==="reset"?loadSession(session.id):session,body));
  const messageForCommand=text(body.message);
  const command=localCommand(messageForCommand,session,currentOffers(session),session.activeCheckId?readCheck(session.id,session.activeCheckId):null);
  if(command)return transaction(()=>{
    const oldVersion=session.version;
    if(body.version!==oldVersion||loadSession(session.id).version!==oldVersion)throw new AppError("این صفحه قدیمی است؛ آخرین وضعیت بارگذاری می‌شود.",409,"STALE_VERSION");
    addMessage(session,"user",messageForCommand);
    if("answer" in command){session.version++;addMessage(session,"assistant",command.answer);saveSession(session,oldVersion);return snapshot(session);}
    return actSync(session,{...command,version:oldVersion});
  });
  const prepared=transaction(()=>{
    const oldVersion=session.version;
    if(body.version!==oldVersion||loadSession(session.id).version!==oldVersion) throw new AppError("این صفحه قدیمی است؛ آخرین وضعیت بارگذاری می‌شود.",409,"STALE_VERSION");
    const message=text(body.message);session.version++;

    const previous=session.messages.slice();addMessage(session,"user",message);
    const extracted=preferencesFromText(message,session.preferences);
    session.preferences=validatePreferences(extracted.preferences as unknown as Record<string,unknown>,session.preferences);
    invalidate(session);session.selectedProductId=null;
    if(extracted.ambiguous) {session.pendingQuestion="budget";session.stage="discover";addMessage(session,"assistant","منظور از این مبلغ چند تومان است؟ مثلاً «۲۰ میلیون تومان» را بنویسید تا سقف بودجه اشتباه نشود.");}
    if(extracted.ambiguous) {saveSession(session,oldVersion);return {session,previous,message,done:true};}
    {
      if(session.pendingQuestion==="budget"&&/^\s*[۰-۹0-9]+\s*$/.test(message)) {const budget=parseBudget(`${message} تومان`);if(budget.value) session.preferences.budget=budget.value;}
      saveSession(session,oldVersion);

    }
    return {session,previous,message,done:false};
  });
  if(prepared.done) return snapshot(prepared.session);
  const {previous,message}=prepared;
  const intent=await understandRequest(message,previous);
  return transaction(()=>{
      if(loadSession(session.id).version!==session.version) throw new AppError("پاسخ درخواست قبلی کنار گذاشته شد؛ شرایط جدید شما حفظ شده است.",409,"STALE_VERSION");
      session.preferences.useCase=intent.useCase||session.preferences.useCase;session.preferences.feature=intent.feature||session.preferences.feature;
      const newCategory=/گوشی|موبایل|هندزفری|هدفون|کفش|لپ.?تاپ|یخچال|تلویزیون|کامپیوتر|اسپیکر|دوربین/.test(message)||/[a-z]+\d/i.test(message);
      const answerOnly=!newCategory&&(parseBudget(message).mentioned||/مکالمه|رفت.?و.?آمد|روزمره|عکاسی|والدین|دانشجویی|باتری|نویز/.test(message));
      const query=answerOnly&&session.query?session.query:intent.query;
      session.query=query;
      if(!query||["سامسونگ","شیائومی","اپل","انکر"].includes(query.trim())) {
        session.stage="discover";session.pendingQuestion="category";
        addMessage(session,"assistant","چه کالایی می‌خواهید و مهم‌ترین کاربردتان چیست؟ مثلاً گوشی برای عکاسی یا هندزفری برای مکالمه.");
      } else {
        session.products=searchWithPreferences(session,query);
        session.pendingQuestion=!/[a-z]+\d/i.test(query)?(session.preferences.budget===null?"budget":!session.preferences.useCase?"useCase":null):null;
        session.stage=session.products.length?"products":"empty";
        addMessage(session,"assistant",session.products.length?(session.pendingQuestion==="budget"?"این گزینه‌ها از کاتالوگ بازیابی شدند. سقف بودجه‌تان چند تومان است؟ با تعیین بودجه، مقایسه دقیق‌تر می‌شود.":session.pendingQuestion==="useCase"?"این گزینه‌ها در بودجهٔ شما هستند. کاربرد اصلی یا ویژگی مهم‌تان چیست؟ مثلاً مکالمه، باتری یا عکاسی. می‌توانید همین حالا هم مدل را انتخاب کنید.":"گزینه‌های کاتالوگ با سقف بودجهٔ شما بررسی شدند. مشخصات و تفاوت‌ها را مقایسه و مدل دقیق را انتخاب کنید."):"با عبارت و بودجهٔ فعلی در این دیتاست گزینه‌ای پیدا نشد. این نتیجه به معنی نبود کالا در تهران نیست؛ عبارت یا شرط را با انتخاب خودتان تغییر دهید.");
        addEvent(session,"catalogue_search",`${session.products.length} محصول مرتبط از کاتالوگ بازیابی شد؛ ${intent.modelUsed?"استخراج نیاز با مدل":"جست‌وجوی قطعی بدون اتکا به پاسخ مدل"}.`);
      }
      const reservedVersion=session.version;session.version++;
      saveSession(session,reservedVersion);return snapshot(session);
  });
}
