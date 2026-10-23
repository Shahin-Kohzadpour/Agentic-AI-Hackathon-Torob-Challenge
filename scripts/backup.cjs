// SQLite's backup API includes committed WAL data in a consistent snapshot.
const {DatabaseSync,backup}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
async function backupWorkflow(dir=process.env.DATA_DIR||path.join(process.cwd(),'data')) {
 const source=path.join(dir,'workflow.db');if(!fs.existsSync(source))return null;
 const folder=path.join(dir,'backups');fs.mkdirSync(folder,{recursive:true});
 const target=path.join(folder,`workflow-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
 const db=new DatabaseSync(source,{readOnly:true});
 try{await backup(db,target);const check=new DatabaseSync(target,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Invalid backup')}finally{check.close()}}finally{db.close()}
 return target;
}
module.exports={backupWorkflow};
if(require.main===module)backupWorkflow().then(p=>console.log(p?'Consistent workflow backup created.':'No existing workflow database.')).catch(()=>{console.error('Workflow backup failed.');process.exit(1)});
