import { NextRequest, NextResponse } from "next/server";
import { loadSession } from "@/lib/session";
import { act, snapshot } from "@/lib/workflow";
import {readJson} from "@/lib/http";
import { AppError,object } from "@/lib/validation";
import {rateLimit} from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const COOKIE="torob_session";
function respond(data:unknown,id:string) {
  const response=NextResponse.json(data,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  response.cookies.set(COOKIE,id,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:7*24*3600});
  return response;
}
export async function GET(req:NextRequest) {
  try {const session=loadSession(req.cookies.get(COOKIE)?.value);return respond(snapshot(session),session.id);}
  catch {return NextResponse.json({error:"بارگذاری جلسه ممکن نشد؛ دوباره تلاش کنید."},{status:503});}
}
export async function POST(req:NextRequest) {
  const requestId=randomUUID();
  try {
    const origin=req.headers.get("origin");
    if(origin&&new URL(origin).host!==req.headers.get("host")&&new URL(origin).host!==req.headers.get("x-forwarded-host")) throw new AppError("مبدأ درخواست معتبر نیست.",403);
    if(Number(req.headers.get("content-length")||0)>20000) throw new AppError("درخواست بیش از حد بزرگ است.",413);
    const session=loadSession(req.cookies.get(COOKIE)?.value),body=object(await readJson(req,20000));
    rateLimit(`workflow:${session.id}`,60);
    if(body.action==="chat")rateLimit(`chat:${req.headers.get("x-forwarded-for")?.split(",")[0]||session.id}`,30);
    const result=await act(session,body);
    return respond(result,result.session.id);
  } catch(error) {
    const known=error instanceof AppError;
    console.warn(JSON.stringify({requestId,operation:"workflow",code:known?error.code:"REQUEST_ERROR"}));
    return NextResponse.json({error:known?error.message:error instanceof SyntaxError?"ساختار JSON معتبر نیست.":"درخواست انجام نشد؛ دوباره تلاش کنید.",code:known?error.code:"REQUEST_ERROR",requestId},{status:known?error.status:error instanceof SyntaxError?400:500,headers:{"Cache-Control":"no-store"}});
  }
}
