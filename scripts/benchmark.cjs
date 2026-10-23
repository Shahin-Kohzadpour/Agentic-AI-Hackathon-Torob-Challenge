const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const {searchProducts}=require('../src/lib/services/catalog.ts');
const {understandRequest}=require('../src/lib/agent/client.ts');
const queries=['Anker R50i A3949','R50i NC A3959','سامسونگ S25 FE 256/8','QCY T13','samsung a55','شیائومی Redmi Note 13','آیفون 13','هندزفری','گوشی برای عکاسی','لپ تاپ دانشجویی','کفش چرم','تلویزیون','یخچال','کابل USB C','اسپیکر بلوتوثی','هدفون برای مکالمه','سامسونگ s24 ultra','پاوربانک انکر','دوربین کانن','گوشی ZX999999'];
function summary(values){const a=values.slice().sort((x,y)=>x-y);return {n:a.length,p50_ms:+a[Math.ceil(a.length*.50)-1].toFixed(2),p95_ms:+a[Math.ceil(a.length*.95)-1].toFixed(2),max_ms:+a.at(-1).toFixed(2)}}
(async()=>{
 const rows=[];for(let round=0;round<5;round++)for(const query of queries){const t=performance.now();const result=searchProducts(query);rows.push({query,round,ms:performance.now()-t,ids:result.map(p=>p.product_id)})}
 const report={at:new Date().toISOString(),environment:{node:process.version,platform:process.platform,location:'developer Windows host',database:'full supplied catalogue',cache_note:'First pass and repeated passes; OS caches not flushed. Not an uncached disk benchmark.'},retrieval:{first_pass:summary(rows.filter(r=>r.round===0).map(r=>r.ms)),repeated:summary(rows.filter(r=>r.round>0).map(r=>r.ms)),all:summary(rows.map(r=>r.ms)),rows}};
 if(process.argv.includes('--live-agent')){
  const agent=[];for(const query of queries){const t=performance.now();const intent=await understandRequest(query,[]);const products=searchProducts(intent.query);agent.push({input:query,query:intent.query,model_used:intent.modelUsed,ms:performance.now()-t,ids:products.map(p=>p.product_id)})}
  report.agent={...summary(agent.map(r=>r.ms)),model_used:agent.filter(r=>r.model_used).length,scope:'One constrained native tool extraction plus actual catalogue retrieval; not a stock check or entire purchase journey.',rows:agent};
 }
 const target=process.argv.find(x=>x.endsWith('.json'))||'scratch/benchmark.json';fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(JSON.stringify({retrieval:{first_pass:report.retrieval.first_pass,repeated:report.retrieval.repeated,all:report.retrieval.all},agent:report.agent?{n:report.agent.n,p50_ms:report.agent.p50_ms,p95_ms:report.agent.p95_ms,model_used:report.agent.model_used}:null}));
})().catch(e=>{console.error(e.name);process.exit(1)});
