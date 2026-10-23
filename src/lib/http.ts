import {AppError} from "./validation";
export async function readJson(request:Request,limit:number):Promise<unknown> {
  const reader=request.body?.getReader();if(!reader)throw new AppError("بدنهٔ درخواست خالی است.");
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();throw new AppError("حجم درخواست بیش از حد مجاز است.",413)}chunks.push(part.value)}}finally{reader.releaseLock()}
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new AppError("ساختار JSON معتبر نیست.");}
}
