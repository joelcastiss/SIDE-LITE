import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=join(root,'public');
const list=['index.html','app.js','campaign.js','style.css','neon-session.js','bff-session.js',
 'assets/logo-side.png','assets/Poppins-Regular.ttf','assets/Poppins-SemiBold.ttf'];
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',
 png:'image/png',ttf:'font/ttf'};
const assets={};
for(const file of list){
 let content=await readFile(join(publicDir,file));
 if(file==='app.js'){
  let text=content.toString('utf8');
  const before="import {createNeonSession} from './neon-session.js';";
  if(!text.includes("import {createBffSession} from './bff-session.js';")){
   if(!text.includes(before))throw Error('No se encontró el import original en public/app.js');
   text=text.replace(before,before+"\nimport {createBffSession} from './bff-session.js';");
  }
  const old="const neon=window.sideLiteNeonClient ? createNeonSession(window.sideLiteNeonClient) : null;";
  if(text.includes(old))text=text.replace(old,
   "const neon=window.sideLiteBff ? createBffSession() : (window.sideLiteNeonClient ? createNeonSession(window.sideLiteNeonClient) : null);");
  if(!text.includes('window.sideLiteBff ? createBffSession()'))throw Error('No se pudo activar la sesión BFF');
  content=Buffer.from(text);
 }
 const ext=file.slice(file.lastIndexOf('.')+1);
 assets[file]={type:types[ext],data:content.toString('base64')};
}
assets['boot.js']={type:types.js,data:Buffer.from('window.sideLiteBff=true;').toString('base64')};
const handler=await readFile(join(root,'remote/bff-function.js'),'utf8');
const output=join(root,'tests/output/bff/index.mjs');
await mkdir(dirname(output),{recursive:true});
await writeFile(output,handler+'\nconst ASSETS='+JSON.stringify(assets)+';\n');
console.log('BFF generado:',output,'archivos:',Object.keys(assets).length);
