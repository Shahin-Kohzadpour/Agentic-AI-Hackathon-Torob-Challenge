// Real catalogue + real workflow. Only the simulator clock is advanced in tests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'torob-acceptance-'));
process.env.AGENT_OFFLINE='1';
const {act,snapshot}=require('../src/lib/workflow.ts');
const {loadSession,readCheck,putCheck,allChecks}=require('../src/lib/session.ts');
const {getDatabase}=require('../src/lib/db.ts');
const {searchProducts,offersForProduct,getProductDetails}=require('../src/lib/services/catalog.ts');
const {shoppingAreas}=require('../src/lib/services/areas.ts');
const {paymentEvidence,hoursEvidence}=require('../src/lib/policy.ts');
const {parseBudget,understandRequest}=require('../src/lib/agent/client.ts');
const {DEFAULT_PREFERENCES}=require('../src/types/workflow.ts');
const R50='product_92ac53fa75e18e8e73f20b56';
const exact='Anker Soundcore R50i A3949';
const held=new Set(['Q05','Q06','Q13','Q15','Q19','Q22','Q25','Q27','Q30','Q35','Q38','Q39']);
function scenario(id,title,fn){test(`${id}${held.has(id)?' [held-out]':''}: ${title}`,fn);}
const action=(d,name,extra={})=>act(loadSession(d.session.id),{action:name,version:d.session.version,...extra});
async function ask(message){return act(loadSession(),{action:'chat',version:0,message});}
async function stores(message=exact,preferences={}){
 let d=await ask(message);if(Object.keys(preferences).length)d=await action(d,'preferences',{preferences});
 assert.ok(d.session.products.length,'catalogue candidates');
 return action(d,'select_product',{productId:d.session.products[0].product_id});
}
async function checked(outcome,budget=4_200_000){
 let d=await stores(exact,{payment:'torobpay',budget});d=await action(d,'scenario',{scenario:outcome});
 d=await action(d,'check',{offerId:d.offers[0].offer_id});
 const c=readCheck(d.session.id,d.activeCheck.id);c.readyAt=new Date(0).toISOString();putCheck(c);
 return snapshot(loadSession(d.session.id));
}
scenario('Q01','commuting discovery asks a useful question',async()=>{
 const d=await ask('هندزفری برای رفت‌وآمد');assert.equal(d.session.pendingQuestion,'budget');assert.ok(d.session.products.length);assert.match(d.session.messages.at(-1).text,/بودجه/);
});
scenario('Q02','call need and budget are grounded',async()=>{
 const d=await ask('هدفون برای مکالمه با بودجه ۴ میلیون تومان');assert.equal(d.session.preferences.useCase,'مکالمه');assert.ok(d.session.products.length);assert.ok(d.session.products.every(p=>p.min_price_toman<=4e6));assert.match(d.session.products[0].tradeoff_summary,/ثبت|کافی/);
});
scenario('Q03','camera and battery request returns phones',async()=>{
 const d=await ask('گوشی برای عکس و باتری');assert.ok(d.session.products.length);assert.ok(d.session.products.every(p=>p.category_name==='گوشی موبایل'));assert.equal(d.session.pendingQuestion,'budget');
});
scenario('Q04','simple parent phone need is recorded',async()=>{
 const d=await ask('گوشی ساده برای والدین');assert.equal(d.session.preferences.useCase,'استفادهٔ ساده');assert.equal(d.session.pendingQuestion,'budget');assert.ok(d.session.products.every(p=>p.category_name==='گوشی موبایل'));
});
scenario('Q05','student laptop returns catalogue laptop candidates',async()=>{
 const d=await ask('لپ‌تاپ دانشجویی');assert.ok(d.session.products.length);assert.ok(d.session.products.every(p=>/لپ|نوت/.test(p.category_name)));assert.equal(d.session.preferences.useCase,'دانشجویی');
});
scenario('Q06','leather footwear makes no ungrounded material claim',async()=>{
 const d=await ask('کفش چرم');assert.ok(d.session.products.length);assert.ok(d.session.products.every(p=>/کفش/.test(p.category_name)&&!/جا.?کفشی/.test(p.persian_title)));assert.ok(!d.session.messages.at(-1).text.includes('چرم طبیعی'));
});
scenario('Q07','ambiguous toman amount is clarified',async()=>{
 const d=await ask('۲۰ تومن بودجه دارم');assert.equal(d.session.pendingQuestion,'budget');assert.equal(d.session.preferences.budget,null);assert.equal(d.session.stage,'discover');
});
scenario('Q08','brand alone asks the category',async()=>{
 const d=await ask('سامسونگ');assert.equal(d.session.pendingQuestion,'category');assert.equal(d.session.stage,'discover');
});
scenario('Q09','exact R50i identity',()=>assert.equal(searchProducts(exact)[0].product_id,R50));
scenario('Q10','NC identity stays NC',()=>{const p=searchProducts('R50i NC A3959');assert.ok(p.length);assert.ok(p.every(x=>/NC/i.test(x.persian_title)));assert.ok(p.every(x=>x.product_id!==R50));});
scenario('Q11','S25 FE 256/8 excludes accessories and other storage',()=>{const p=searchProducts('سامسونگ S25 FE 256/8');assert.ok(p.length);assert.ok(p.every(x=>x.category_name==='گوشی موبایل'&&/256/.test(x.persian_title)&&/FE/i.test(x.persian_title)));});
scenario('Q12','QCY T13 is a headphone',()=>{const p=searchProducts('QCY T13');assert.ok(p.length);assert.ok(p.every(x=>/هدفون|هندزفری/.test(x.category_name)));});
scenario('Q13','Arabic forms and Persian code digits normalize',()=>{assert.deepEqual(searchProducts('سامسونگ s۲۵ fe').map(p=>p.product_id),searchProducts('سامسونگ s25 fe').map(p=>p.product_id));});
scenario('Q14','English brand alias retains expected identity',()=>assert.equal(searchProducts('Anker R50i A3949')[0].product_id,searchProducts('انکر R50i A3949')[0].product_id));
scenario('Q15','variant evidence is retained verbatim per offer',()=>{
 const offers=offersForProduct(R50,structuredClone(DEFAULT_PREFERENCES));assert.ok(offers.length>2);
 for(const o of offers){const raw=getDatabase().prepare('SELECT seller_title,warranty FROM offers WHERE offer_id=?').get(o.offer_id);assert.equal(o.seller_title,raw.seller_title);assert.equal(o.warranty,raw.warranty||null);}
});
scenario('Q16','selection preserves ID rather than title lookup',async()=>{let d=await ask('QCY T13');const id=d.session.products.at(-1).product_id;d=await action(d,'select_product',{productId:id});assert.equal(d.session.selectedProductId,id);assert.ok(d.offers.every(o=>o.product_id===id));});
scenario('Q17','lower budget invalidates an active check',async()=>{
 let d=await stores(exact,{budget:4.2e6,payment:'torobpay'});d=await action(d,'check',{offerId:d.offers[0].offer_id});const id=d.activeCheck.id;d=await action(d,'preferences',{preferences:{budget:3e6}});assert.equal(d.activeCheck,null);assert.equal(d.visit,null);assert.equal(readCheck(d.session.id,id).status,'CANCELLED');assert.equal(d.offers.length,0);
});
scenario('Q18','higher budget recalculates without dropping payment',async()=>{let d=await ask(exact+' تا ۳ میلیون تومان با ترب‌پی');assert.equal(d.session.products.length,0);d=await action(d,'preferences',{preferences:{budget:4.2e6}});assert.ok(d.session.products.length);assert.equal(d.session.preferences.payment,'torobpay');assert.equal(d.session.products[0].min_price_toman,3150000);});
scenario('Q19','manual location recalculates distances',async()=>{let d=await stores();const before=d.offers[0].distance_km;d=await action(d,'preferences',{preferences:{location:{lat:35.7575,lon:51.4099,label:'ونک'}}});assert.notEqual(d.offers[0].distance_km,before);assert.equal(d.session.preferences.location.label,'ونک');});
scenario('Q20','radius remains strict',async()=>{let d=await stores();d=await action(d,'preferences',{preferences:{radiusKm:0.1}});assert.ok(d.offers.every(o=>o.distance_km!==null&&o.distance_km<=0.1));assert.equal(d.session.preferences.radiusKm,0.1);});
scenario('Q21','arrival edit invalidates successful evidence',async()=>{let d=await checked('AVAILABLE');d=await action(d,'preferences',{preferences:{arrivalAt:'2026-10-24T12:00:00+03:30'}});assert.equal(d.activeCheck,null);assert.equal(d.visit,null);await assert.rejects(()=>action(d,'visit',{checkId:'check_old'}));});
scenario('Q22','cancel/reset discard late checks and stale edits',async()=>{
 let d=await stores();d=await action(d,'check',{offerId:d.offers[0].offer_id});const old=structuredClone(d),id=d.activeCheck.id;d=await action(d,'cancel_check');assert.equal(readCheck(d.session.id,id).status,'CANCELLED');await assert.rejects(()=>act(old.session,{action:'preferences',version:old.session.version,preferences:{budget:1}}),e=>e.code==='STALE_VERSION');const fresh=await action(d,'reset');assert.notEqual(fresh.session.id,d.session.id);assert.equal(fresh.session.stage,'discover');
});
scenario('Q23','exact two installment offers and distinct shops',()=>{const p={...structuredClone(DEFAULT_PREFERENCES),budget:4.2e6,payment:'torobpay'};const offers=offersForProduct(R50,p);assert.deepEqual(offers.map(o=>o.price_toman),[3150000,3850000]);assert.equal(new Set(offers.map(o=>o.shop_id)).size,2);});
scenario('Q24','mandatory installment requirement never falls back',async()=>{const d=await ask('سامسونگ S25 FE 256/8 با ترب‌پی حضوری');assert.equal(d.session.products.length,0);assert.equal(d.session.preferences.payment,'torobpay');});
scenario('Q25','unknown payment channel is not accepted',()=>assert.equal(paymentEvidence(JSON.stringify([{provider_name:'ترب‌پی',channel:'unknown'}]),1000,'کفش').eligible,false));
scenario('Q26','control and chat share one payment state',async()=>{let d=await stores();d=await action(d,'preferences',{preferences:{payment:'torobpay'}});assert.equal(d.session.preferences.payment,'torobpay');assert.equal(d.offers.length,2);assert.ok(d.offers.every(o=>o.has_torob_pay_in_person));});
scenario('Q27','provider amount/category restrictions are enforced',()=>{for(const extra of [{max_price_toman:900},{min_price_toman:2000},{max_price_toman:0},{category_names:['کفش']}])assert.equal(paymentEvidence(JSON.stringify([{provider_name:'ترب‌پی',channel:'in_person',...extra}]),1000,'گوشی موبایل').eligible,false);});
scenario('Q28','explicit removal of payment requirement is applied',async()=>{let d=await ask(exact+' با ترب‌پی');d=await action(d,'chat',{message:'شرط ترب‌پی را حذف کن؛ نقدی هم قبول است'});assert.equal(d.session.preferences.payment,'any');});
scenario('Q29','failed cheaper seller yields real 3.85m replacement',async()=>{const d=await checked('NO_ANSWER');assert.equal(d.activeCheck.status,'NO_ANSWER');const offer=d.offers.find(o=>o.offer_id===d.session.selectedOfferId);assert.equal(offer.price_toman,3850000);assert.notEqual(offer.shop_id,d.activeCheck.shopId);assert.ok(d.session.events.some(e=>e.action==='replan'));});
scenario('Q30','non-demo product replans after no stock',async()=>{
 let d=await stores('سامسونگ S25 FE 256/8');const original=d.offers[0];d=await action(d,'scenario',{scenario:'OUT_OF_STOCK'});d=await action(d,'check',{offerId:original.offer_id});const c=readCheck(d.session.id,d.activeCheck.id);c.readyAt=new Date(0).toISOString();putCheck(c);d=snapshot(loadSession(d.session.id));assert.equal(d.activeCheck.status,'OUT_OF_STOCK');assert.ok(d.offers.length);const backup=d.offers.find(o=>o.offer_id===d.session.selectedOfferId);assert.notEqual(backup.shop_id,original.shop_id);assert.equal(backup.product_id,original.product_id);assert.notEqual(backup.product_id,R50);
});
scenario('Q31','observed price within budget is separate and confirmed explicitly',async()=>{let d=await checked('PRICE_CHANGED');assert.equal(d.activeCheck.observedPrice,3465000);assert.equal(d.checkedOffer.price_toman,3150000);d=await action(d,'visit',{checkId:d.activeCheck.id});assert.equal(d.visit.check.observedPrice,3465000);assert.equal(d.visit.check.source,'simulation');});
scenario('Q32','changed price outside budget cannot form a visit',async()=>{let d=await checked('PRICE_CHANGED',3.2e6);assert.equal(d.offers.length,0);assert.equal(d.session.selectedOfferId,null);await assert.rejects(()=>action(d,'visit',{checkId:d.activeCheck.id}));assert.equal(d.session.preferences.budget,3.2e6);});
scenario('Q33','closing outcome blocks that shop',async()=>{const d=await checked('CLOSING');assert.equal(d.activeCheck.status,'CLOSING');assert.ok(d.offers.every(o=>o.shop_id!==d.activeCheck.shopId));assert.equal(d.session.stage,'stores');});
scenario('Q34','unknown hours need explicit verification choice',async()=>{
 const d=await stores(exact,{payment:'torobpay',requireOpen:true,arrivalAt:'2026-10-23T15:00:00+03:30'});assert.equal(d.offers.length,0);assert.ok(d.unknownHourOffers.length);const id=d.unknownHourOffers[0].offer_id;await assert.rejects(()=>action(d,'check',{offerId:id}));const verified=await action(d,'check',{offerId:id,verifyUnknownHours:true});assert.equal(verified.activeCheck.status,'CHECKING');
});
scenario('Q35','Friday, split, overnight and placeholders',()=>{
 const raw=JSON.stringify({fri:{status:'closed'},sat:{status:'declared',shifts:[{start_time:'09:00',end_time:'12:00'},{start_time:'17:00',end_time:'20:00'}]},sun:{status:'declared',shifts:[{start_time:'22:00',end_time:'02:00'}]},mon:{status:'closed'}});
 assert.equal(hoursEvidence(raw,'2026-10-23T10:00:00+03:30').status,'closed_declared');assert.equal(hoursEvidence(raw,'2026-10-24T13:00:00+03:30').status,'closed_declared');assert.equal(hoursEvidence(raw,'2026-10-24T11:50:00+03:30').status,'closed_declared');assert.equal(hoursEvidence(raw,'2026-10-26T01:00:00+03:30').status,'open_declared');assert.equal(hoursEvidence('{"fri":{"status":"declared","shifts":[{"start_time":"00:00","end_time":"00:00"}]}}','2026-10-23T10:00:00+03:30').status,'unknown');
});
scenario('Q36','ambiguous variant does not authorize visit',async()=>{const d=await checked('AMBIGUOUS_VARIANT');assert.equal(d.activeCheck.status,'AMBIGUOUS_VARIANT');await assert.rejects(()=>action(d,'visit',{checkId:d.activeCheck.id}));});
scenario('Q37','unknown model shows coverage limitation and grounded area',async()=>{const d=await ask('گوشی مدل ZX999999');assert.equal(d.session.stage,'empty');assert.match(d.session.messages.at(-1).text,/دیتاست/);const areas=shoppingAreas('گوشی ZX999999');assert.ok(areas.length);assert.ok(areas.every(a=>a.sourceUrl&&a.checkedAt&&a.sourceKind));assert.equal(shoppingAreas('کالای کاملاً ناشناخته').length,0);});
scenario('Q38','unknown and zero prices never rank as the cheapest',()=>{const row=getDatabase().prepare('SELECT product_id FROM offers WHERE price_toman IS NULL LIMIT 1').get();assert.ok(row);const offers=offersForProduct(row.product_id,structuredClone(DEFAULT_PREFERENCES));assert.ok(offers.every(o=>Number.isSafeInteger(o.price_toman)&&o.price_toman>0));});
scenario('Q39','missing specifications and media remain missing',()=>{const row=getDatabase().prepare("SELECT product_id FROM products WHERE specs='[]' LIMIT 1").get();const p=getProductDetails(row.product_id);assert.deepEqual(p.specs,[]);assert.ok(Array.isArray(p.image_urls));});
scenario('Q40','model outage still supports deterministic catalogue search',async()=>{const intent=await understandRequest(exact,[]);assert.equal(intent.modelUsed,false);assert.equal(searchProducts(intent.query)[0].product_id,R50);assert.equal(parseBudget('بیست و پنج میلیون تومان').value,25e6);assert.equal(parseBudget('۴٬۲۰۰٬۰۰۰ تومان').value,4.2e6);});
