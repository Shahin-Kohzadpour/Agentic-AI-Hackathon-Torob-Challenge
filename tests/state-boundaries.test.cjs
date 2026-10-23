const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'torob-boundaries-'));process.env.AGENT_OFFLINE='1';
const {loadSession,readCheck,putCheck,allChecks}=require('../src/lib/session.ts');
const {act,snapshot,currentOffers}=require('../src/lib/workflow.ts');
const agent=require('../src/lib/agent/client.ts');
const {getDatabase}=require('../src/lib/db.ts');
const {readJson}=require('../src/lib/http.ts');
const {backupWorkflow}=require('../scripts/backup.cjs');
const {DatabaseSync}=require('node:sqlite');
const {validatePreferences}=require('../src/lib/policy.ts');
const {DEFAULT_PREFERENCES}=require('../src/types/workflow.ts');
const {customerText}=require('../src/lib/customer-copy.ts');

test('a confirmed location requires a valid explicit point and survives reload',async()=>{
 assert.throws(()=>validatePreferences({locationConfirmed:true},DEFAULT_PREFERENCES));
 assert.throws(()=>validatePreferences({locationConfirmed:'yes',location:DEFAULT_PREFERENCES.location},DEFAULT_PREFERENCES));
 assert.throws(()=>validatePreferences({locationConfirmed:true,location:{lat:32.6,lon:51.6,label:'outside'}},DEFAULT_PREFERENCES));
 const s=loadSession();
 const location={lat:35.7575,lon:51.4099,label:'موقعیت فعلی من'};
 const d=await act(s,{action:'preferences',version:s.version,preferences:{location,locationConfirmed:true}});
 const restored=snapshot(loadSession(d.session.id));
 assert.equal(restored.session.preferences.locationConfirmed,true);
 assert.deepEqual(restored.session.preferences.location,location);
});
test('customer wording never converts internal checks into a seller confirmation',()=>{
 const text=customerText('پاسخ شبیه‌سازی‌شده: فروشنده موجودی همین عنوان آفر را اعلام کرد.');
 assert.match(text,/نیاز دارند/);assert.doesNotMatch(text,/فروشنده.*اعلام کرد|شبیه/);
 assert.match(customerText('در این دیتاست گزینه‌ای پیدا نشد'),/نتایج فعلی/);
});
const action=(d,a,extra={})=>act(loadSession(d.session.id),{action:a,version:d.session.version,...extra});
async function stores(){let d=await act(loadSession(),{action:'chat',version:0,message:'Anker R50i A3949 با ترب‌پی و بودجه ۴٫۲ میلیون تومان'});return action(d,'select_product',{productId:d.session.products[0].product_id});}
function advance(d){const c=readCheck(d.session.id,d.activeCheck.id);c.readyAt=new Date(0).toISOString();putCheck(c);return snapshot(loadSession(d.session.id));}

test('failed action rolls back cancellations, checks and session changes',async()=>{
 let d=await stores();d=await action(d,'check',{offerId:d.offers[0].offer_id});const version=d.session.version,id=d.activeCheck.id,count=allChecks(d.session.id).length;
 await assert.rejects(()=>action(d,'check',{offerId:'offer_forged'}));assert.equal(readCheck(d.session.id,id).status,'CHECKING');assert.equal(loadSession(d.session.id).version,version);assert.equal(allChecks(d.session.id).length,count);
});
test('duplicate action with an old version cannot create another job',async()=>{
 const d=await stores(),old=structuredClone(d.session);await action(d,'check',{offerId:d.offers[0].offer_id});
 await assert.rejects(()=>act(old,{action:'check',version:old.version,offerId:d.offers[0].offer_id}),e=>e.code==='STALE_VERSION');assert.equal(allChecks(d.session.id).length,1);
});
test('reset during a model response discards the late run',async()=>{
 const original=agent.understandRequest;let resolve;agent.understandRequest=()=>new Promise(r=>resolve=r);
 try{const session=loadSession();const pending=act(session,{action:'chat',version:0,message:'هندزفری برای مکالمه'});const reserved=loadSession(session.id);
 const fresh=await act(reserved,{action:'reset',version:0});resolve({query:'هندزفری',useCase:'مکالمه',feature:null,modelUsed:false});
 await assert.rejects(()=>pending,e=>e.code==='STALE_VERSION');assert.notEqual(fresh.session.id,reserved.id);assert.equal(loadSession(fresh.session.id).messages.length,0);
 }finally{agent.understandRequest=original;}
});
test('native chat commands check the actual offer, explain recovery and build a visit',async()=>{
 let d=await stores();d=await action(d,'chat',{message:'ارزان‌ترین فروشگاه را بررسی کن'});d=advance(d);assert.equal(d.activeCheck.status,'NO_ANSWER');
 d=await action(d,'chat',{message:'چه اتفاقی افتاد؟'});assert.match(d.session.messages.at(-1).text,/۷۰۰٬۰۰۰/);assert.match(d.session.messages.at(-1).text,/گارانتی/);
 d=await action(d,'chat',{message:'جایگزین را بررسی کن'});d=advance(d);assert.equal(d.activeCheck.status,'AVAILABLE');
 d=await action(d,'chat',{message:'برنامه مراجعه را بساز'});assert.equal(d.visit.check.observedPrice,3850000);
});
test('a later successful retry supersedes an older failure for the same shop',async()=>{
 let d=await stores();const id=d.offers[0].offer_id,shop=d.offers[0].shop_id;d=await action(d,'check',{offerId:id});d=advance(d);assert.ok(!d.offers.some(o=>o.shop_id===shop));
 d=await action(d,'scenario',{scenario:'AVAILABLE'});d=await action(d,'check',{offerId:id});d=advance(d);assert.ok(d.offers.some(o=>o.shop_id===shop));
});
test('a failure on one product does not suppress a shop on another product',async()=>{
 let d=await stores();const shop=d.offers[0].shop_id;d=await action(d,'check',{offerId:d.offers[0].offer_id});d=advance(d);
 const row=getDatabase().prepare('SELECT product_id FROM offers WHERE shop_id=? AND product_id<>? AND price_toman>0 LIMIT 1').get(shop,d.session.selectedProductId);assert.ok(row);
 const state=structuredClone(d.session);state.selectedProductId=row.product_id;state.preferences.payment='any';assert.ok(currentOffers(state).some(o=>o.shop_id===shop));
});
test('bounded request parser rejects invalid JSON and oversized streamed input',async()=>{
 await assert.rejects(()=>readJson(new Request('http://localhost',{method:'POST',body:'{'}),100),e=>e.status===400);
 await assert.rejects(()=>readJson(new Request('http://localhost',{method:'POST',body:JSON.stringify({message:'a'.repeat(20100)})}),20000),e=>e.status===413);
 assert.deepEqual(await readJson(new Request('http://localhost',{method:'POST',body:'{"action":"reset"}'}),100),{action:'reset'});
});
test('SQLite backup contains committed WAL state and checks',async()=>{
 const target=await backupWorkflow(process.env.DATA_DIR);assert.ok(target);const db=new DatabaseSync(target,{readOnly:true});try{assert.ok(db.prepare('SELECT COUNT(*) n FROM sessions').get().n>0);assert.ok(db.prepare('SELECT COUNT(*) n FROM seller_checks').get().n>0);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok')}finally{db.close()}
});
