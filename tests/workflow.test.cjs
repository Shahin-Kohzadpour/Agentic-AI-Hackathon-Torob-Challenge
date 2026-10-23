const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'torob-tests-'));
process.env.AGENT_OFFLINE='1';
const {DEFAULT_PREFERENCES}=require('../src/types/workflow.ts');
const {searchProducts,findEligibleOffers,offersForProduct}=require('../src/lib/services/catalog.ts');
const {hoursEvidence,paymentEvidence}=require('../src/lib/policy.ts');
const {parseBudget}=require('../src/lib/agent/client.ts');
const {loadSession,readCheck,putCheck}=require('../src/lib/session.ts');
const {act,snapshot}=require('../src/lib/workflow.ts');
const PRODUCT='product_92ac53fa75e18e8e73f20b56';
const PHONE='product_6c62d575e3d247f6f29e051a';

test('exact product retrieval preserves R50i variant and excludes phone accessories',()=>{
 assert.equal(searchProducts('Anker Soundcore R50i A3949')[0].product_id,PRODUCT);
 const phones=searchProducts('سامسونگ s25 fe');
 assert.ok(phones.length>0);assert.ok(phones.every(p=>p.category_name==='گوشی موبایل'&&/FE/i.test(p.persian_title)));
 assert.ok(searchProducts('r50i',null,1_000_000).every(p=>p.min_price_toman<=1_000_000));
});

test('sneaker discovery excludes shoe care, drains and unrelated footwear',()=>{
 const shoes=searchProducts('کفش کتونی',null,null,12);
 assert.ok(shoes.length>0);
 assert.ok(shoes.every(p=>/کتانی|کتونی|اسپرت/.test(p.category_name)&&!/اسپری|کفشور|خشک کن|بوگیر/.test(p.persian_title)));
 const phones=searchProducts('iphone 13');
 assert.ok(phones.length>0);
 assert.ok(phones.every(p=>p.category_name==='گوشی موبایل'&&/13/.test(p.persian_title)));
});
test('mandatory TorobPay never falls back to cash and null prices do not rank as zero',()=>{
 assert.equal(findEligibleOffers(PHONE,35.6948,51.4089,null,null,true).length,0);
 const offers=findEligibleOffers(PRODUCT,35.6948,51.4089,null,4_200_000,true);
 assert.deepEqual(offers.map(o=>o.price_toman),[3_150_000,3_850_000]);
 assert.ok(offers.every(o=>Number.isSafeInteger(o.price_toman)&&o.price_toman>0));
});
test('payment evidence requires channel, valid bounds and category',()=>{
 const evidence=o=>paymentEvidence(JSON.stringify([o]),1000,'گوشی موبایل').eligible;
 assert.equal(evidence({provider_name:'ترب‌پی',channel:'unknown'}),false);
 assert.equal(evidence({provider_name:'ترب‌پی',channel:'in_person',min_price_toman:null,max_price_toman:null}),true);
 assert.equal(evidence({provider_name:'ترب‌پی',channel:'in_person',max_price_toman:900}),false);
 assert.equal(evidence({provider_name:'ترب‌پی',channel:'in_person',max_price_toman:0}),false);
 assert.equal(evidence({provider_name:'ترب‌پی',channel:'in_person',category_names:['کفش']}),false);
});
test('Tehran hours respect Friday, split shifts, overnight and zero placeholders',()=>{
 const raw=JSON.stringify({fri:{status:'closed',shifts:[]},sat:{status:'declared',shifts:[{start_time:'09:00:00',end_time:'12:00:00'},{start_time:'17:00:00',end_time:'20:00:00'}]},sun:{status:'declared',shifts:[{start_time:'22:00:00',end_time:'02:00:00'},{start_time:'00:00:00',end_time:'00:00:00'}]},mon:{status:'closed',shifts:[]}});
 assert.equal(hoursEvidence(raw,'2026-10-23T10:00:00+03:30').status,'closed_declared');
 assert.equal(hoursEvidence(raw,'2026-10-24T13:00:00+03:30').status,'closed_declared');
 assert.equal(hoursEvidence(raw,'2026-10-24T11:50:00+03:30').status,'closed_declared');
 assert.equal(hoursEvidence(raw,'2026-10-24T17:30:00+03:30').status,'open_declared');
 assert.equal(hoursEvidence(raw,'2026-10-26T01:00:00+03:30').status,'open_declared');
 assert.equal(hoursEvidence('{}','2026-10-23T10:00:00+03:30').status,'unknown');
});
test('Persian amounts preserve exact money and ask about ambiguous toman',()=>{
 assert.equal(parseBudget('بودجه ۴٫۲ میلیون تومان').value,4_200_000);
 assert.equal(parseBudget('چهار میلیون و دویست هزار تومان').value,4_200_000);
 assert.equal(parseBudget('۲۰ تومن').ambiguous,true);
});
test('real-offer seller failure recovers to distinct shop and exact backup price',async()=>{
 let data=await act(loadSession(),{action:'chat',version:0,message:'Anker Soundcore R50i A3949 با بودجه ۴٫۲ میلیون تومان و ترب‌پی حضوری'});
 assert.equal(data.session.products[0].product_id,PRODUCT);
 assert.equal(data.session.products[0].min_price_toman,3_150_000);
 data=await act(data.session,{action:'select_product',version:data.session.version,productId:PRODUCT});
 const first=data.offers[0],backup=data.offers[1];
 data=await act(data.session,{action:'check',version:data.session.version,offerId:first.offer_id});
 let check=readCheck(data.session.id,data.session.activeCheckId);check.readyAt=new Date(0).toISOString();putCheck(check);
 data=snapshot(loadSession(data.session.id));
 assert.equal(data.activeCheck.status,'NO_ANSWER');assert.equal(data.session.selectedOfferId,backup.offer_id);
 assert.ok(data.offers.every(o=>o.shop_id!==first.shop_id));
 data=await act(data.session,{action:'check',version:data.session.version,offerId:backup.offer_id});
 check=readCheck(data.session.id,data.session.activeCheckId);check.readyAt=new Date(0).toISOString();putCheck(check);
 data=snapshot(loadSession(data.session.id));
 assert.equal(data.activeCheck.status,'AVAILABLE');assert.equal(data.activeCheck.observedPrice,3_850_000);
 data=await act(data.session,{action:'visit',version:data.session.version,checkId:data.activeCheck.id});
 assert.equal(data.visit.offer.offer_id,backup.offer_id);assert.equal(data.visit.check.source,'simulation');assert.equal(data.visit.check.observedPrice,3_850_000);
 assert.equal(loadSession(data.session.id).stage,'visit');
});
test('forged offer, fabricated visit and stale actions are rejected',async()=>{
 const session=loadSession();
 await assert.rejects(()=>act(structuredClone(session),{action:'check',version:0,offerId:'offer_nonexistent'}));
 await assert.rejects(()=>act(structuredClone(session),{action:'visit',version:0,checkId:'check_nonexistent'}));
 await assert.rejects(()=>act(structuredClone(session),{action:'chat',version:99,message:'گوشی'}),e=>e.code==='STALE_VERSION');
});
test('session isolation and mandatory unknown arrival hours',()=>{
 const a=loadSession(),b=loadSession();assert.notEqual(a.id,b.id);assert.deepEqual(loadSession(a.id).preferences,DEFAULT_PREFERENCES);
 const offers=offersForProduct(PRODUCT,{...structuredClone(DEFAULT_PREFERENCES),payment:'torobpay',requireOpen:true,arrivalAt:'2026-10-23T15:00:00+03:30'});
 assert.equal(offers.length,0);
});
