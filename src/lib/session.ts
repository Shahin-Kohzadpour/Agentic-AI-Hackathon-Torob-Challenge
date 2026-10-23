import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PREFERENCES, type ShoppingSession, type CheckRecord, type WorkflowEvent } from "@/types/workflow";
import { AppError } from "./validation";

let instance: DatabaseSync | null=null;
export function workflowDatabase() {
  if(instance) return instance;
  const dir=process.env.DATA_DIR||path.join(process.cwd(),"data");
  fs.mkdirSync(dir,{recursive:true});
  instance=new DatabaseSync(path.join(dir,"workflow.db"));
  instance.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, version INTEGER NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS seller_checks (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, body TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS checks_session ON seller_checks(session_id);
    CREATE TABLE IF NOT EXISTS workflow_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, body TEXT NOT NULL);`);
  return instance;
}
export function loadSession(id?: string): ShoppingSession {
  const db=workflowDatabase();
  if(id && /^[a-f0-9-]{36}$/.test(id)) {
    const row=db.prepare("SELECT body FROM sessions WHERE id=?").get(id) as {body:string}|undefined;
    if(row) return JSON.parse(row.body);
  }
  const now=new Date().toISOString();
  const session:ShoppingSession={id:randomUUID(),version:0,createdAt:now,updatedAt:now,preferences:structuredClone(DEFAULT_PREFERENCES),stage:"discover",messages:[],products:[],selectedProductId:null,selectedOfferId:null,activeCheckId:null,visitCheckId:null,scenario:"AUTO",events:[],query:"",pendingQuestion:null};
  db.prepare("INSERT INTO sessions(id,version,body,updated_at) VALUES(?,?,?,?)").run(session.id,0,JSON.stringify(session),now);
  return session;
}
export function saveSession(session:ShoppingSession, expectedVersion:number) {
  session.updatedAt=new Date().toISOString();
  const result=workflowDatabase().prepare("UPDATE sessions SET version=?,body=?,updated_at=? WHERE id=? AND version=?").run(session.version,JSON.stringify(session),session.updatedAt,session.id,expectedVersion);
  if(!result.changes) throw new AppError("شرایط خرید تغییر کرده است؛ نتیجهٔ قبلی اعمال نشد.",409,"STALE_VERSION");
  return session;
}
/** Keep a transition, its checks and its evidence in one SQLite commit. Never await inside. */
export function transaction<T>(work:()=>T):T {
  const db=workflowDatabase();
  if(db.isTransaction) return work();
  db.exec("BEGIN IMMEDIATE");
  try {const result=work();db.exec("COMMIT");return result;}
  catch(error) {db.exec("ROLLBACK");throw error;}
}
export function addEvent(session:ShoppingSession, action:string, message:string, offerId?:string,source:WorkflowEvent["source"]="dataset") {
  const event:WorkflowEvent={id:randomUUID(),at:new Date().toISOString(),action,message,offerId,source};
  session.events=[...session.events,event].slice(-40);
  workflowDatabase().prepare("INSERT INTO workflow_events(id,session_id,body) VALUES(?,?,?)").run(event.id,session.id,JSON.stringify(event));
  return event;
}
export function putCheck(check:CheckRecord) {
  workflowDatabase().prepare("INSERT INTO seller_checks(id,session_id,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body").run(check.id,check.sessionId,JSON.stringify(check));
}
export function readCheck(sessionId:string,id:string):CheckRecord|null {
  const row=workflowDatabase().prepare("SELECT body FROM seller_checks WHERE id=? AND session_id=?").get(id,sessionId) as {body:string}|undefined;
  return row?JSON.parse(row.body):null;
}
export function allChecks(sessionId:string):CheckRecord[] {
  return (workflowDatabase().prepare("SELECT body FROM seller_checks WHERE session_id=? ORDER BY rowid").all(sessionId) as Array<{body:string}>).map(r=>JSON.parse(r.body));
}
export function addMessage(session:ShoppingSession,role:"user"|"assistant",text:string) {
  session.messages=[...session.messages,{id:randomUUID(),role,text,at:new Date().toISOString()}].slice(-40);
}
