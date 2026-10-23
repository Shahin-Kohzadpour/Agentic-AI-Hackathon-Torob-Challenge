const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'torob-journey-'));process.env.AGENT_OFFLINE='1';
const {journeyFromText,isJourneyFollowup}=require('../src/lib/agent/journey.ts');
const {preferencesFromText,parseBudget}=require('../src/lib/agent/client.ts');
const {assessVisit,buildDecision}=require('../src/lib/services/decision.ts');
const {DEFAULT_PREFERENCES}=require('../src/types/workflow.ts');
const {validatePreferences}=require('../src/lib/policy.ts');
const {act}=require('../src/lib/workflow.ts');
const {loadSession}=require('../src/lib/session.ts');
const {shoppingAreas}=require('../src/lib/services/areas.ts');
const now=new Date('2026-10-23T19:00:00+03:30');
const prefs=()=>({...structuredClone(DEFAULT_PREFERENCES),departureAt:'2026-10-23T23:30:00+03:30'});
const route=minutes=>({minutes,distanceKm:1,source:'estimate',observedAt:now.toISOString()});
const hours=(start,end)=>JSON.stringify({fri:{status:'declared',shifts:[{start_time:start,end_time:end}]}});
test('Journey: 11:30 at night and preferred walking radius are explicit',()=>{
 const p=journeyFromText('ساعت ۱۱:۳۰ شب است. پیاده می‌روم و ترجیح می‌دهم بیشتر از ۲ کیلومتر راه نروم',now);
 assert.equal(p.departureAt,'2026-10-23T23:30:00+03:30');assert.equal(p.travelMode,'walking');assert.equal(p.radiusKm,2);assert.equal(p.radiusMode,'preferred');
 assert.equal(journeyFromText('بیش از ۲ کیلومتر نمی‌روم',now).radiusMode,'hard');
});
test('Journey: radius and clock numbers are not a budget',()=>{assert.equal(parseBudget('تا ۲ کیلومتر راه می‌روم').ambiguous,false);assert.equal(parseBudget('تا ۲ کیلومتر راه می‌روم').value,null);});
test('Journey: fixed GPS is not replaced by a destination mention',()=>{const p={...prefs(),locationConfirmed:true};assert.deepEqual(preferencesFromText('فروشگاه در ونک می‌خواهم',p).preferences.location,p.location);});
test('Journey: store closing before arrival is closed',()=>assert.equal(assessVisit(hours('09:00','23:40'),prefs(),route(15)).status,'closed'));
test('Journey: short remaining shopping time is distinct from closed',()=>assert.equal(assessVisit(hours('09:00','23:59'),prefs(),route(15)).status,'closing'));
test('Journey: unknown hours are not reported as closed',()=>assert.equal(assessVisit(null,prefs(),route(10)).status,'unknown'));
test('Journey: overnight previous-day shift survives midnight',()=>{
 const p=prefs();p.departureAt='2026-10-23T23:55:00+03:30';assert.equal(assessVisit(hours('20:00','02:00'),p,route(20)).status,'open');
});
test('Journey: cannot reach an appointment before departure plus travel',()=>{const p=prefs();p.arrivalAt='2026-10-23T23:40:00+03:30';const result=assessVisit(hours('20:00','02:00'),p,route(20));assert.equal(result.status,'closing');assert.match(result.reason,/نمی‌رسید/);});
test('Journey: invalid transport/radius mode and unzoned time are rejected',()=>{for(const value of [{travelMode:'flight'},{radiusMode:'ignore'},{departureAt:'2026-10-23T23:30'}])assert.throws(()=>validatePreferences(value,prefs()));});
test('Journey: new item is not mistaken for a route follow-up',()=>{assert.equal(isJourneyFollowup('اگر با ماشین بروم؟',true),true);assert.equal(isJourneyFollowup('گوشی تا ۳۰ میلیون تومان می‌خواهم',true),false);});
test('Journey: charger search, hubs and transport follow-up keep catalogue identities and constraints',async()=>{
 let d=await act(loadSession(),{action:'chat',version:0,message:'ساعت ۱۱:۳۰ شب است و نزدیک چهارراه ولیعصر تهران هستم. همین امشب شارژر سامسونگ می‌خواهم؛ پیاده و ترجیحاً تا ۲ کیلومتر.'});
 assert.ok(d.session.products.length);assert.ok(d.session.products.every(p=>p.category_name==='شارژر گوشی'));
 assert.equal(d.session.preferences.travelMode,'walking');assert.equal(d.session.preferences.radiusMode,'preferred');
 d=await act(loadSession(d.session.id),{action:'select_product',version:d.session.version,productId:d.session.products[0].product_id});
 const selected=d.session.selectedProductId,query=d.session.query;
 d=await act(loadSession(d.session.id),{action:'chat',version:d.session.version,message:'اگر با ماشین بروم چه؟'});
 assert.equal(d.session.selectedProductId,selected);assert.equal(d.session.query,query);assert.equal(d.session.preferences.travelMode,'driving');assert.ok(d.hubs.length);
 const decision=await buildDecision(d);assert.ok(decision.shops.length);assert.ok(decision.hubs.length);assert.ok(decision.shops.every(c=>c.offer.product_id===selected));
 assert.equal(decision.version,d.session.version);
});
test('Journey: impossible budget with installments never becomes a shop recommendation',async()=>{
 let d=await act(loadSession(),{action:'chat',version:0,message:'همین امشب شارژر سامسونگ تا ۱۰۰۰ تومان با ترب پی می‌خواهم'});
 const decision=await buildDecision(d);assert.equal(decision.shops.length,0);assert.equal(d.session.preferences.payment,'torobpay');assert.equal(d.session.preferences.budget,1000);assert.ok(decision.hubs.length);
});
test('Journey: hub proximity ranking changes with origin',()=>{
 const a=shoppingAreas('شارژر سامسونگ',{lat:35.7,lon:51.4});assert.ok(a.length);assert.ok(a.every((h,i)=>!i||h.distance_km>=a[i-1].distance_km));
});
test('Journey: midnight in natural language advances to the following Tehran date',()=>assert.equal(journeyFromText('ساعت ۱۲ شب',now).departureAt,'2026-10-24T00:00:00+03:30'));
test('Journey: urgent seller checks cannot approve a shop closed at arrival',async()=>{
 let d=await act(loadSession(),{action:'chat',version:0,message:'ساعت ۱۱:۳۰ شب شارژر سامسونگ می‌خواهم'});
 d=await act(loadSession(d.session.id),{action:'select_product',version:d.session.version,productId:d.session.products[0].product_id});
 const decision=await buildDecision(d),closed=decision.shops.find(c=>c.status==='closed'||c.status==='closing');
 if(closed)await assert.rejects(()=>act(loadSession(d.session.id),{action:'check',version:d.session.version,offerId:closed.offer.offer_id}),/بسته|تعطیلی|نمی‌رسید/);
 else {
  const {offersForProduct}=require('../src/lib/services/catalog.ts'),{getDatabase}=require('../src/lib/db.ts');
  const found=offersForProduct(d.session.selectedProductId,d.session.preferences).find(o=>{const raw=getDatabase().prepare('SELECT weekly_hours FROM shops WHERE shop_id=?').get(o.shop_id).weekly_hours;return ['closed','closing'].includes(assessVisit(raw,d.session.preferences,route(15)).status)});
  assert.ok(found,'registered closed shop fixture');await assert.rejects(()=>act(loadSession(d.session.id),{action:'check',version:d.session.version,offerId:found.offer_id}),/بسته|تعطیلی|نمی‌رسید/);
 }
});
