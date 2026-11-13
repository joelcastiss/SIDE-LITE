import {chromium} from 'playwright';
import express from 'express';
import {execFileSync} from 'node:child_process';
const server=await new Promise(resolve=>{const s=express().use('/SIDE-LITE',express.static('.')).use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
for(const before of [true,false]) for(const width of [1900,768,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.route('https://joelcastiss.github.io/**',async route=>{const u=new URL(route.request().url());if(before && /\/(?:docente.html|css\/laboratorio.css|css\/design-system.css|js\/lite-laboratory.js|laboratory.js)$/.test(u.pathname)){try{const f=u.pathname.replace('/SIDE-LITE/','');const body=execFileSync('git',['show','560b56e:'+f]);return route.fulfill({body,contentType:f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/javascript'})}catch{}}return route.fulfill({response:await route.fetch({url:base+u.pathname+u.search})})});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test-teacher',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 const game={id:'game1',code:'ABC',name:'Prueba',cycle_count:3,costs:{basic:50,standard:80,premium:120}};
 const result={revenue:10000,costOfSales:8000,marketing:1000,profit:1000,cashEnd:41000,sold:100};
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
  const req=route.request(),p=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let json={};if(p==='/me')json={id:'t1',display_name:'Docente',role:'teacher'};else if(p==='/catalog')json=[];else if(p==='/games')json=[game];else if(p==='/games/game1/laboratory')json={cycles:[{id:'c1',number:1}],companies:[{id:'a',name:'Empresa'}],records:[{cycle_id:'c1',company_id:'a',decision:{quality:'standard',quantity:100,price:100,marketingAmount:1000},result}]};else if(p==='/games/game1')json={isTeacher:true,game,companies:[{id:'a',name:'Empresa',cash:41000}],cycles:[],results:[],decisions:[],ranking:[]};else if(p==='/games/game1/podium')json={companies:[],finished:true};
  return route.fulfill({status:200,headers,json});
 });
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/public/docente.html');
 if(!before) await page.screenshot({path:`output/qa-laboratorio-real/navegacion-referencia-${width}.png`,fullPage:true});
 await page.locator('[data-tab=laboratorio]').click({timeout:20000});
 await page.locator('.lab-finance').waitFor({timeout:20000});
 await page.screenshot({path:`output/qa-laboratorio-real/navegacion-${before?'antes':'despues'}-${width}.png`,fullPage:true});
 console.log(width,await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,table:document.querySelector('.lab-finance').scrollWidth,client:document.querySelector('.lab-finance').clientWidth})));
 await page.close();
}
await browser.close();await new Promise(resolve=>server.close(resolve));
