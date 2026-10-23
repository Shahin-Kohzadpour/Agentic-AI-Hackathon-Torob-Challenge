import {NextRequest,NextResponse} from "next/server";
import sharp from "sharp";
import {getProductDetails} from "@/lib/services/catalog";
import {AppError,identifier} from "@/lib/validation";
import {rateLimit} from "@/lib/rate-limit";
export const runtime="nodejs";
export async function GET(req:NextRequest) {
  try {
    const product=getProductDetails(identifier(req.nextUrl.searchParams.get("productId"),"product"));
    if(!product||!product.image_urls[0])return new NextResponse(null,{status:404});
    const url=new URL(product.image_urls[0]);
    if(url.protocol!=="https:"||url.hostname!=="image.torob.com")return new NextResponse(null,{status:404});
    rateLimit(`product-image:${req.headers.get("x-forwarded-for")?.split(",")[0]||"anonymous"}`,120);
    const response=await fetch(url,{signal:AbortSignal.timeout(5000),redirect:"error",next:{revalidate:86400}});
    if(!response.ok||!response.headers.get("content-type")?.startsWith("image/"))return new NextResponse(null,{status:503});
    const reader=response.body?.getReader();if(!reader)return new NextResponse(null,{status:503});
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8*1024*1024){await reader.cancel();return new NextResponse(null,{status:413})}chunks.push(part.value)}
    const bytes=await sharp(Buffer.concat(chunks),{limitInputPixels:16_000_000}).resize({width:480,height:480,fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();
    return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=86400, stale-while-revalidate=604800","X-Content-Type-Options":"nosniff"}});
  } catch(error){return new NextResponse(null,{status:error instanceof AppError?error.status:503});}
}
