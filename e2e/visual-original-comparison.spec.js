// Capturas comparativas contra los archivos originales locales, sin tocar SIDE Original.
// Ejecutar con SIDE_ORIGINAL_DIR y SIDE_VISUAL_CAPTURE=YES; no son pruebas de autenticación.
import {test,expect} from '@playwright/test';
import express from 'express';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const original=process.env.SIDE_ORIGINAL_DIR,enabled=process.env.SIDE_VISUAL_CAPTURE==='YES'&&!!original;
test.skip(!enabled,'Requiere ruta local de SIDE Original y SIDE_VISUAL_CAPTURE=YES');
let server,base,markup;
test.beforeAll(async()=>{
 markup=await readFile(path.join(original,'tutorial.html'),'utf8');await mkdir('output/comparacion-visual-real',{recursive:true});
 const app=express();app.use('/lite',express.static('public'));app.use('/original',express.static(original),async(req,res)=>{
  const relative=decodeURIComponent(req.path).replace(/^\/+/, '');if(!/^(assets|css|js)\/[A-Za-z0-9_./-]+$/.test(relative)||relative.includes('..'))return res.sendStatus(404);
  try{const bytes=execFileSync('git',['-C',original,'show','HEAD:'+relative],{maxBuffer:3*1024*1024,stdio:['ignore','pipe','ignore']});return res.type(path.extname(relative)).send(bytes)}catch{return res.sendStatus(404)}
 });server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{if(server)await new Promise(resolve=>server.close(resolve))});
for(const width of [1440,390])test(`comparación directa de espera y panel docente ${width}px`,async({browser})=>{
 test.setTimeout(90000);const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),originalPage=await context.newPage(),litePage=await context.newPage();
 await originalPage.route('**/original/js/**',route=>new URL(route.request().url()).pathname.endsWith('/tutorial.js')?route.continue():route.abort());
 await originalPage.goto(base+'/original/index.html',{waitUntil:'domcontentloaded'});
 await originalPage.evaluate(async html=>{
  document.querySelectorAll('.screen').forEach(e=>e.classList.add('hidden'));
  const lobby=document.querySelector('#studentLobby');lobby.classList.remove('hidden');lobby.classList.add('is-waiting');document.querySelector('#studentWaiting').classList.remove('hidden');
  document.querySelector('#waitingGameName').textContent='Partida · Empresa · ABC123';document.querySelector('#waitingCompanies').textContent='1 empresa conectada';document.querySelector('#studentIntegrationNotice').textContent='La partida comenzará cuando el docente inicie el ciclo.';
  const mount=document.querySelector('#waitingTutorialMount');mount.innerHTML=html;const label=mount.querySelector('.tutorial-required');if(label)label.textContent='APRENDE MIENTRAS ESPERAS';window.initSIDETutorial(null,{root:mount.querySelector('.tutorial-shell'),loop:true});
 },markup);
 await expect(originalPage.locator('#studentWaiting')).toBeVisible();await originalPage.screenshot({path:`output/comparacion-visual-real/original-espera-${width}.png`});
 const company={id:'co',name:'Empresa',store:'Tienda',cash:30000,initial_capital:30000,inventory:[]},game={id:'g',name:'Partida',code:'ABC123',cycle_count:3,costs:{basic:50,standard:80,premium:120}};
 await litePage.route('**/api/**',route=>{const req=route.request(),p=new URL(req.url()).pathname;return route.fulfill({json:p.endsWith('/me')?{id:'u',role:'student',name:'Ana'}:p.endsWith('/catalog')?[]:p.endsWith('/games/g')?{game,isTeacher:false,company,companies:[company],cycles:[],results:[],ranking:[]}:p.endsWith('/games')?[game]:{}})});
 await litePage.goto(base+'/lite/');await litePage.getByRole('button',{name:'Partida',exact:true}).click();await expect(litePage.locator('#waitingTutorialMount .tutorial-slide')).toHaveCount(6);expect(await litePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await litePage.screenshot({path:`output/comparacion-visual-real/lite-espera-${width}.png`});
 await originalPage.goto(base+'/original/docente.html',{waitUntil:'domcontentloaded'});await originalPage.screenshot({path:`output/comparacion-visual-real/original-docente-${width}.png`});
 await litePage.unroute('**/api/**');await litePage.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({json:p.endsWith('/me')?{id:'u',role:'teacher',name:'Ana'}:[]})});await litePage.goto(base+'/lite/');await expect(litePage.locator('#create')).toBeVisible();expect(await litePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await litePage.screenshot({path:`output/comparacion-visual-real/lite-docente-${width}.png`});
 await context.close();
});
