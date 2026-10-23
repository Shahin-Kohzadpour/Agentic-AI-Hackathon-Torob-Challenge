const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {pipeline}=require('node:stream/promises');
const {spawn}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const {backupWorkflow}=require('./backup.cjs');
(async()=>{
 const dir=process.env.DATA_DIR||'/app/data';fs.mkdirSync(dir,{recursive:true});
 // A versioned catalogue preserves the previous release's data for rollback.
 const target=path.join(dir,'catalogue-v3.db');
 if(!fs.existsSync(target)) {
  const seed=path.join('/app/seed','torob.db.gz');
  if(!fs.existsSync(seed)) throw new Error('Catalogue seed missing; upload the verified dataset before starting.');
  const tmp=target+'.initializing';
  await pipeline(fs.createReadStream(seed),zlib.createGunzip(),fs.createWriteStream(tmp));
  const db=new DatabaseSync(tmp,{readOnly:true});
  const counts=['shops','products','offers'].map(table=>db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n);
  db.close();if(JSON.stringify(counts)!=='[6476,225903,331506]') throw new Error('Catalogue row count failed validation.');
  fs.renameSync(tmp,target);console.log('Verified full catalogue initialized on persistent disk.');
 }
 await backupWorkflow(dir);
 process.env.CATALOGUE_PATH=target;
 const child=spawn(process.execPath,['server.js'],{cwd:'/app',stdio:'inherit',env:process.env});
 for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>process.exit(code||0));
})().catch(()=>{console.error('Persistent catalogue initialization failed. Check seed and disk configuration.');process.exit(1)});
