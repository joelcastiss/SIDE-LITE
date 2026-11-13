import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
await mkdir('output/qa-laboratorio-real',{recursive:true});
const browser=await chromium.launch({headless:true});
for (const before of [true,false]) for (const width of [1900,768,390]) {
 const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
 await page.route('http://side.test/**',async route=>{
  const pathname=new URL(route.request().url()).pathname; let file='public'+(pathname==='/'?'/docente.html':pathname); let body;
  try { body=before?execFileSync('git',['show','560b56e:'+file]):await readFile(file); } catch {try {body=await readFile(file)} catch{return route.fulfill({status:404,body:''})}}
  if(pathname==='/'){
   let html=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('class="teacher-auth-pending"','');
   html=html.replace('</body>',`<script>window.SIDLiteGame={request:async p=>p==='/games'?[{id:'g',name:'Prueba',code:'ABC'}]:{cycles:[{id:'c1',number:1},{id:'c2',number:2},{id:'c3',number:3}],companies:[{id:'a',name:'Empresa'}],records:[{cycle_id:'c1',company_id:'a',decision:{quality:'standard',quantity:100,price:100,marketingAmount:1000},result:{revenue:10000,costOfSales:8000,marketing:1000,profit:1000,cashEnd:41000,sold:100}},{cycle_id:'c3',company_id:'a',decision:{quality:'standard',quantity:100,price:100,marketingAmount:1000},result:{revenue:10000,costOfSales:10000,marketing:1000,profit:-1000,cashEnd:1250000,sold:100}}]}}</script><script type="module" src="/js/lite-laboratory.js"></script></body>`);body=html;
  }
  const ext=path.extname(file);return route.fulfill({body,contentType:({'html':'text/html','.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.woff2':'font/woff2'}[ext]||'application/octet-stream')});
 });
 await page.goto('http://side.test/');
 await page.screenshot({path:`output/qa-laboratorio-real/referencia-configuracion-${width}.png`,fullPage:true});
 await page.evaluate(()=>{document.querySelector('#tab-configuracion').classList.remove('active');document.querySelector('#tab-laboratorio').classList.add('active');document.querySelector('[data-tab=configuracion]').classList.remove('active');document.querySelector('[data-tab=laboratorio]').classList.add('active');document.querySelector('#pageTitle').textContent='Laboratorio Estratégico';document.dispatchEvent(new CustomEvent('side-lite-laboratory-open'))});
 await page.locator('.lab-finance').waitFor();await page.screenshot({path:`output/qa-laboratorio-real/${before?'antes':'despues'}-${width}.png`,fullPage:true});
 if(!before){
  await page.locator('#lab-cycle').selectOption('c3');await page.locator('.lab-evolution-cycles').waitFor();
  await page.screenshot({path:`output/qa-laboratorio-real/extremos-${width}.png`,fullPage:true});
  console.log(width,JSON.stringify(await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth,table:document.querySelector('.lab-finance').scrollWidth,tableClient:document.querySelector('.lab-finance').clientWidth,profit:document.querySelector('.lab-finance-profit td').textContent,cash:document.querySelector('.lab-finance-cash td').textContent,segments:document.querySelectorAll('.lab-evolution svg line').length}))));
 }
 await page.close();
}
await browser.close();
