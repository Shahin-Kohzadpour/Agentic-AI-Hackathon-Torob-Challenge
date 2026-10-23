const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const root = process.cwd();
fs.mkdirSync(path.join(root,'scratch'),{recursive:true});
const cache = new Map();
let llmTool = null;
const quiet = { ...console, warn() {}, error() {} };
class OfflineOpenAI {
  constructor() {
    this.chat = { completions: { create: async () => {
      if (!llmTool) throw new Error('Audit: provider intentionally offline');
      if (llmTool.used) return { choices: [{ message: { role: 'assistant', content: 'کارت آماده شد' } }] };
      llmTool.used = true;
      return { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'audit_call', type: 'function', function: { name: llmTool.name, arguments: JSON.stringify(llmTool.args) } }] } }] };
    } } };
  }
}
const neshan = Object.fromEntries(['getLiveTrafficRoute','getPedestrianRoute','getStoreLocationContext','getBatchDistanceMatrix'].map(k=>[k,async()=>k==='getBatchDistanceMatrix'?[]:null]));
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const customRequire = id => {
    if (id === 'openai') return OfflineOpenAI;
    if (id.endsWith('/neshan') || id === './neshan') return neshan;
    if (id.startsWith('.') || id.startsWith('@/')) {
      const resolved = id.startsWith('@/') ? path.join(root,'src',id.slice(2)) : path.resolve(path.dirname(file),id);
      return load(resolved+'.ts');
    }
    return require(id);
  };
  const fn = vm.runInThisContext('(function(require,module,exports,__dirname,console){'+code+'\n})',{filename:file});
  fn(customRequire,mod,mod.exports,path.dirname(file),quiet);
  return mod.exports;
}
async function main() {
  const cat=load(path.join(root,'src/lib/services/catalog.ts'));
  const sim=load(path.join(root,'src/lib/services/seller-simulator.ts'));
  const agent=load(path.join(root,'src/lib/agent/client.ts'));
  const db=load(path.join(root,'src/lib/db.ts')).getDatabase();
  const pid='product_92ac53fa75e18e8e73f20b56';
  const queries=['r50i','Anker Soundcore R50i A3949','R50i NC A3959','سامسونگ s25 fe','qcy t13','هندزفری انکر','کفش چرم','لپ‌تاپ','لپ تاپ','برای رفت‌وآمد هندزفری با بودجه ۴٫۲ میلیون تومان','سامسونگ s۲۵','zzzxxyynonexistent'];
  const search=queries.map(q=>{const t=performance.now();const results=cat.searchProducts(q);return {q,ms:+(performance.now()-t).toFixed(2),results};});
  const base=search[0].results[0];
  const budget=Math.floor(base.min_price_toman/1.1);
  const budgetResults=cat.searchProducts('r50i',null,budget,3);
  const noPayPid='product_6c62d575e3d247f6f29e051a';
  const payFallback=cat.findEligibleOffers(noPayPid,35.6948,51.4089,null,null,true);
  const all=cat.findEligibleOffers(pid);
  const gold=cat.findEligibleOffers(pid,35.6948,51.4089,null,4200000,true);
  const jobs={}, normalJobs={};
  for(const scenario of ['AUTO','FORCE_AVAILABLE','FORCE_NO_ANSWER','FORCE_OUT_OF_STOCK','FORCE_PRICE_CHANGE']) {
    sim.setJudgeScenarioOverride(scenario);
    jobs[scenario]=sim.startSellerCheckJob(gold[0].offer_id,gold[0].shop_name,gold[0].seller_title,gold[0].price_toman);
    normalJobs[scenario]=sim.startSellerCheckJob(gold[1].offer_id,gold[1].shop_name,gold[1].seller_title,gold[1].price_toman,true);
  }
  sim.setJudgeScenarioOverride('AUTO');
  const invalidJob=sim.startSellerCheckJob('offer_does_not_exist','فروشگاه ساختگی','مدل ساختگی',123);
  const fallbackVisit=await agent.runShoppingAgent([{role:'user',content:'کارت نهایی مراجعه حضوری و مسیر را نمایش بده'}]);
  llmTool={name:'build_visit_plan',args:{product_title:'ساختگی',shop_id:'shop_nonexistent',confirmed_price_toman:7}};
  const invalidNativeVisit=await agent.runShoppingAgent([{role:'user',content:'کارت مراجعه را بساز'}]);
  llmTool=null;
  const constrained=[{role:'user',content:'بودجه من ۱۰۰۰۰۰ تومان است و ترب‌پی حضوری اجباری است'},{role:'assistant',content:'متوجه شدم'},{role:'user',content:'مدل «هدفون بلوتوثی انکر Soundcore R50i مدل A3949» را انتخاب کردم. فروشگاه‌های حضوری موجود در تهران را نمایش بده.'}];
  const fallbackStores=await agent.runShoppingAgent(constrained);
  const results={mode:'Actual TypeScript services loaded with TypeScript transpilation; LLM and Neshan intentionally stubbed; real SQLite read',search,budget:{maxBudget:budget,results:budgetResults,overBudget:budgetResults.filter(p=>p.min_price_toman>budget)},paymentFallback:{requested:true,offers:payFallback.length,withoutTorobPay:payFallback.filter(o=>!o.has_torob_pay_in_person).length},storeCounts:{offers:all.length,distinctShops:new Set(all.map(o=>o.shop_id)).size},gold,jobs,normalJobs,invalidJob,fallbackVisit,invalidNativeVisit,fallbackStores};
  fs.writeFileSync('scratch/audit-runtime-results.json',JSON.stringify(results,null,2));
  fs.writeFileSync('scratch/audit-ui-fixtures.json',JSON.stringify({products:{textResponse:'مقایسه محصولات کاتالوگ',uiComponent:{type:'ProductComparison',props:{products:cat.searchProducts('r50i')}}},stores:{textResponse:'فروشگاه‌ها',uiComponent:{type:'StoreResults',props:{product_id:pid,product_title:base.persian_title,offers:gold,user_location_name:'جمهوری',filters:{max_budget:4200000,torob_pay_only:true,max_distance_km:null}}}},visit:fallbackVisit}));
  console.log(JSON.stringify({search:search.map(x=>({q:x.q,ms:x.ms,titles:x.results.map(r=>r.persian_title)})),budget:{max:budget,over:results.budget.overBudget.map(p=>p.min_price_toman)},paymentFallback:results.paymentFallback,storeCounts:results.storeCounts,jobs:Object.fromEntries(Object.entries(jobs).map(([k,v])=>[k,v.status])),invalidJob:invalidJob.status,fallbackVisit:fallbackVisit.uiComponent,invalidNativeVisit:invalidNativeVisit.uiComponent,fallbackConstraints:fallbackStores.uiComponent?.props.filters},null,2));
  db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
