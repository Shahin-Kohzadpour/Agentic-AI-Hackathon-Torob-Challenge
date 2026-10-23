import {NextRequest,NextResponse} from "next/server";
import {loadSession} from "@/lib/session";
import {getOffer} from "@/lib/services/catalog";
import {getLiveTrafficRoute} from "@/lib/services/neshan";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const cookie=req.cookies.get("torob_session")?.value;
 if(!cookie)return NextResponse.json({error:"جلسهٔ معتبر لازم است."},{status:401});
 const session=loadSession(cookie),id=req.nextUrl.searchParams.get("offerId")||"",offer=getOffer(id,session.preferences);
 if(!offer||offer.product_id!==session.selectedProductId||offer.lat===null||offer.lon===null)return NextResponse.json({error:"موقعیت آفر معتبر نیست."},{status:404});
 const route=await getLiveTrafficRoute(session.preferences.location.lat,session.preferences.location.lon,offer.lat,offer.lon);
 return NextResponse.json({route,observedAt:new Date().toISOString(),source:"neshan"},{status:route?200:503});
}
