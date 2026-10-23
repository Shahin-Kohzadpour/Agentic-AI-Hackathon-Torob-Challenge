// Test-only loader: execute the same TypeScript services used by Next.js.
const ts=require('typescript');
const Module=require('module');
const path=require('node:path');
const fs=require('node:fs');
const original=Module._resolveFilename;
Module._resolveFilename=function(id,parent,...args){return original.call(this,id.startsWith('@/')?path.join(process.cwd(),'src',id.slice(2)):id,parent,...args)};
require.extensions['.ts']=function(mod,file){mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file)};
