import { NextRequest, NextResponse } from "next/server";
import { searchProducts, findEligibleOffers, attachLiveTrafficToOffers } from "@/lib/services/catalog";
import { AppError, finiteNumber, identifier, money, text } from "@/lib/validation";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  try {
    const p=req.nextUrl.searchParams;
    const budget=p.has("maxBudget")?money(Number(p.get("maxBudget"))):null;
    const type=p.get("type")||"products";
    if(type==="offers") {
      const id=identifier(p.get("productId"),"product");
      const radius=p.has("maxDistanceKm")?finiteNumber(Number(p.get("maxDistanceKm")),0.1,100):null;
      const lat=p.has("lat")?finiteNumber(Number(p.get("lat")),35.3,36):35.6948;
      const lon=p.has("lon")?finiteNumber(Number(p.get("lon")),50.8,51.9):51.4089;
      if(p.has("torobPayOnly")&&!["true","false"].includes(p.get("torobPayOnly")!)) throw new AppError("روش پرداخت معتبر نیست.");
      let offers=findEligibleOffers(id,lat,lon,radius,budget,p.get("torobPayOnly")==="true");
      if(p.get("liveRoute")==="true") offers=await attachLiveTrafficToOffers(offers,lat,lon);
      return NextResponse.json({offers},{headers:{"Cache-Control":"no-store"}});
    }
    if(type!=="products") throw new AppError("نوع جست‌وجو معتبر نیست.");
    const query=text(p.get("q"),500),category=p.has("category")?text(p.get("category"),100):null;
    const limit=p.has("limit")?finiteNumber(Number(p.get("limit")),1,12):3;
    if(!Number.isInteger(limit))throw new AppError("تعداد نتایج باید عدد صحیح باشد.");
    return NextResponse.json({products:searchProducts(query,category,budget,limit)},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return NextResponse.json({error:error instanceof AppError?error.message:"جست‌وجو در دسترس نیست."},{status:error instanceof AppError?error.status:503});
  }
}
