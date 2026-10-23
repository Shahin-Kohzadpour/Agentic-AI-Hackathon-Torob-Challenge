import {NextRequest,NextResponse} from "next/server";
import {getStaticMapUrl} from "@/lib/services/neshan";
import {AppError,finiteNumber} from "@/lib/validation";
import {rateLimit} from "@/lib/rate-limit";
export async function GET(req:NextRequest) {
  try {
    const p=req.nextUrl.searchParams;
    if(!p.has("lat")||!p.has("lon"))throw new AppError("مختصات نقشه لازم است.");
    const lat=finiteNumber(Number(p.get("lat")),35.3,36.1),lon=finiteNumber(Number(p.get("lon")),50.7,52);
    const zoom=finiteNumber(Number(p.get("zoom")||15),5,18),width=finiteNumber(Number(p.get("width")||480),100,1024),height=finiteNumber(Number(p.get("height")||200),100,768);
    if(![zoom,width,height].every(Number.isInteger))throw new AppError("ابعاد نقشه معتبر نیست.");
    rateLimit(`map:${req.headers.get("x-forwarded-for")?.split(",")[0]||"anonymous"}`,20);
    const response=await fetch(getStaticMapUrl(lat,lon,zoom,width,height),{signal:AbortSignal.timeout(3500),cache:"no-store"});
    if(!response.ok||!response.headers.get("content-type")?.startsWith("image/"))return new NextResponse("نقشه در دسترس نیست؛ آدرس فروشگاه را ببینید.",{status:503});
    return new NextResponse(await response.arrayBuffer(),{headers:{"Content-Type":response.headers.get("content-type")!,"Cache-Control":"private, max-age=300"}});
  } catch(error) {return new NextResponse(error instanceof AppError?error.message:"نقشه در دسترس نیست.",{status:error instanceof AppError?error.status:503});}
}
