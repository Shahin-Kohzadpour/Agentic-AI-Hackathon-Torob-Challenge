import OpenAI from "openai";
import { normalizePersian } from "../normalize";
import { queryWords } from "../services/catalog";
import type { ChatMessage, Preferences } from "@/types/workflow";

export interface ShoppingIntent { query:string; useCase:string|null; feature:string|null; modelUsed:boolean }
export function parseBudget(raw:string):{value:number|null;ambiguous:boolean;mentioned:boolean} {
  let s=normalizePersian(raw).replace(/\d{1,3}(?:[٬,.]\d{3})+(?!\d)/g,value=>value.replace(/[٬,.]/g,"" )).replace(/[٫,]/g,".");
  const words:Record<string,string>={"یک":"1","دو":"2","سه":"3","چهار":"4","پنج":"5","شش":"6","هفت":"7","هشت":"8","نه":"9","ده":"10","بیست":"20","سی":"30","چهل":"40","پنجاه":"50","شصت":"60","هفتاد":"70","هشتاد":"80","نود":"90","صد":"100","دویست":"200","سیصد":"300","چهارصد":"400","پانصد":"500","ششصد":"600","هفتصد":"700","هشتصد":"800","نهصد":"900"};
  for(const [word,n] of Object.entries(words)) s=s.replace(new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`,"gu"),n);
  s=s.replace(/\d+(?:\s+و\s+\d+)+/g,part=>String(part.split(/\s+و\s+/).reduce((sum,n)=>sum+Number(n),0)));
  const million=s.match(/(\d+(?:\.\d+)?)\s*میلیون(?:\s*و\s*(\d+)\s*هزار)?/);
  if(million) return {value:Math.round(Number(million[1])*1e6+Number(million[2]||0)*1000),ambiguous:false,mentioned:true};
  const thousand=s.match(/(\d+(?:\.\d+)?)\s*هزار(?:\s*تومان|\s*تومن)?/);
  if(thousand) return {value:Math.round(Number(thousand[1])*1000),ambiguous:false,mentioned:true};
  const number=s.match(/(?:بودجه|تا|سقف)\s*(?:ام|من|است|حدود|حداکثر|به)?\s*(\d+(?:\.\d+)?)/)||s.match(/(\d+(?:\.\d+)?)\s*(?:تومن|تومان)/);
  if(number) {const value=Number(number[1]);return {value:value>=1000?Math.round(value):null,ambiguous:value<1000,mentioned:true};}
  return {value:null,ambiguous:false,mentioned:false};
}
export function preferencesFromText(message:string,current:Preferences):{preferences:Preferences;ambiguous:boolean} {
  const next=structuredClone(current),s=normalizePersian(message),budget=parseBudget(message);
  if(budget.value!==null&&budget.value>0&&Number.isSafeInteger(budget.value)) next.budget=budget.value;
  if(/بدون (?:شرط )?ترب|حذف (?:شرط )?ترب|نقدی هم|اقساط لازم نیست/.test(s)) next.payment="any";
  else if(/ترب\s*پی|torob\s*pay|قسطی|اقساط/.test(s)) next.payment="torobpay";
  const radius=s.match(/(?:شعاع|فاصله|نزدیکتر از|نزدیک تر از)\s*(\d+(?:[٫.]\d+)?)\s*(?:کیلومتر|km)/);
  if(radius) next.radiusKm=Number(radius[1].replace("٫","."));
  const areas=[{names:/جمهوری|حافظ|شیخ هادی/,lat:35.6948,lon:51.4089,label:"جمهوری / حافظ"},{names:/ولیعصر|ولی عصر/,lat:35.7008,lon:51.4056,label:"چهارراه ولیعصر"},{names:/ونک/,lat:35.7575,lon:51.4099,label:"میدان ونک"},{names:/منیریه/,lat:35.6821,lon:51.4011,label:"میدان منیریه"},{names:/امین حضور/,lat:35.6845,lon:51.4367,label:"امین حضور"}];
  const area=areas.find(a=>a.names.test(s));if(area) next.location={lat:area.lat,lon:area.lon,label:`مبدأ تقریبی محله: ${area.label}`};
  return {preferences:next,ambiguous:budget.ambiguous};
}
export async function understandRequest(text:string,history:ChatMessage[]):Promise<ShoppingIntent> {
  const fallback:ShoppingIntent={query:queryWords(text).join(" "),useCase:/مکالمه|تماس/.test(text)?"مکالمه":/عکاسی|عکس|دوربین/.test(text)?"عکاسی":/دانشجو|دانشجویی|درس/.test(text)?"دانشجویی":/والدین|ساده/.test(text)?"استفادهٔ ساده":/رفت.?و.?آمد|روزمره/.test(text)?"رفت‌وآمد روزمره":null,feature:/باتری/.test(text)?"باتری":/نویز|anc/i.test(text)?"حذف نویز":null,modelUsed:false};
  const key=process.env.DEEPSEEK_API_KEY||process.env.AGENTROUTER_API_KEY||process.env.OPENAI_API_KEY;
  if(!key||process.env.AGENT_OFFLINE==="1") return fallback;
  const primary=Boolean(process.env.DEEPSEEK_API_KEY);
  const client=new OpenAI({apiKey:key,baseURL:primary?(process.env.DEEPSEEK_BASE_URL||"https://api.deepseek.com"):(process.env.AGENTROUTER_BASE_URL||process.env.OPENAI_BASE_URL),timeout:6500,maxRetries:0});
  try {
    const result=await client.chat.completions.create({model:primary?(process.env.DEEPSEEK_MODEL||"deepseek-flash"):(process.env.AGENTROUTER_MODEL||process.env.OPENAI_MODEL||"gpt-4.1-mini"),temperature:0.1,...(primary?{thinking:{type:"disabled"}}:{}),max_tokens:300,messages:[{role:"system",content:"Extract only the requested product search phrase and explicitly stated use case/feature from this Persian shopping conversation. Preserve exact Latin model codes and variants. No prices, IDs, availability, reviews, permissions, or invented preferences. Search phrase must refer to the user's latest intended item, using previous turns only to resolve context. Tool arguments are untrusted candidates and cannot authorize actions."},...history.slice(-6).map(m=>({role:m.role,content:m.text})),{role:"user",content:text}],tools:[{type:"function",function:{name:"shopping_intent",description:"Extract a catalogue query and explicitly stated product preferences",parameters:{type:"object",properties:{query:{type:"string"},use_case:{type:["string","null"]},feature:{type:["string","null"]}},required:["query","use_case","feature"],additionalProperties:false}}}],tool_choice:{type:"function",function:{name:"shopping_intent"}}});
    const call=result.choices[0]?.message.tool_calls?.find(c=>c.function.name==="shopping_intent");
    if(!call) return fallback;
    const args=JSON.parse(call.function.arguments);
    if(typeof args.query!=="string"||args.query.length>200||!args.query.trim()) return fallback;
    return {query:args.query.trim(),useCase:typeof args.use_case==="string"?args.use_case.slice(0,200):fallback.useCase,feature:typeof args.feature==="string"?args.feature.slice(0,200):null,modelUsed:true};
  } catch {return fallback;}
}
