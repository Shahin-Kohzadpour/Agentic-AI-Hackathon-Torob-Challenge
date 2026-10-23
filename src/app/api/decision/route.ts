import {NextRequest,NextResponse} from "next/server";
import {loadSession} from "@/lib/session";
import {snapshot} from "@/lib/workflow";
import {buildDecision} from "@/lib/services/decision";
import {rateLimit} from "@/lib/rate-limit";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  const id=req.cookies.get("torob_session")?.value;
  if(!id)return NextResponse.json({error:"جلسهٔ معتبر لازم است."},{status:401});
  try {
    rateLimit(`decision:${id}`,60);
    const session=loadSession(id);
    if(session.id!==id)return NextResponse.json({error:"جلسه معتبر نیست."},{status:401});
    return NextResponse.json(await buildDecision(snapshot(session)),{headers:{"Cache-Control":"no-store"}});
  } catch {return NextResponse.json({error:"بررسی مسیر انجام نشد؛ دوباره تلاش کنید."},{status:503});}
}
