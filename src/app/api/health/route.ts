import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { workflowDatabase } from "@/lib/session";
import {RELEASE_VERSION} from "@/lib/release";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET() {
  try {
    const db=getDatabase();
    const row=db.prepare("SELECT product_id FROM products LIMIT 1").get();
    workflowDatabase().prepare("SELECT COUNT(*) FROM sessions").get();
    if(!row) throw new Error("empty");
    const counts=Object.fromEntries(["shops","products","offers"].map(table=>[table,(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as {n:number}).n]));
    return NextResponse.json({status:"ready",catalogue:"available",counts,workflow:"persistent",release:RELEASE_VERSION,at:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  } catch {return NextResponse.json({status:"not_ready"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
