import {NextRequest,NextResponse} from "next/server";
import {shoppingAreas} from "@/lib/services/areas";
import {AppError,text} from "@/lib/validation";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  try{return NextResponse.json({areas:shoppingAreas(text(req.nextUrl.searchParams.get("q"),200)),source:"Torob supplied dataset; area inference only, no live inventory",at:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});}
  catch(error){return NextResponse.json({error:error instanceof AppError?error.message:"اطلاعات محدوده در دسترس نیست."},{status:error instanceof AppError?400:503});}
}
