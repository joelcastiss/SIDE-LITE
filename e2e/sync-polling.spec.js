import {test,expect} from '@playwright/test';
import express from 'express';
let server;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(4398,'127.0.0.1',()=>resolve(s))})});
test.afterAll(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})});
test('el sondeo se recupera tras una petición bloqueada y descarta respuestas antiguas',async({browser})=>{
 test.setTimeout(50000);const context=await browser.newContext(),page=await context.newPage();let cycle=1,hang=false,observed=false;
 const game={id:'game',name:'Partida',code:'ABCD1234',cycle_count:3,costs:{basic:50,standard:80,premium:120}};
 const state=n=>({game,isTeacher:false,company:{id:'company',cash:30000},companies:[{id:'company',name:'Empresa',store:'Tienda',cash:30000,inventory:[]}],cycles:[{id:'cycle-'+n,number:n,status:'open',ends_at:new Date(Date.now()+120000).toISOString(),server_now:new Date().toISOString()}],decisions:[],ownDecision:null,results:[],ranking:[{id:'company',name:'Empresa',returnPercent:0}]});
 await context.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let body=path==='/api/me'?{id:'user',role:'student',display_name:'Alumno'}:path==='/api/games'?[game]:path==='/api/catalog'?[]:path==='/api/games/game'?state(cycle):{};
  if(path==='/api/games/game'&&hang){hang=false;observed=true;const old=body;await new Promise(r=>setTimeout(r,12500));body=old}
  try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})}catch{}
 });
 try{await page.goto('http://127.0.0.1:4398');await page.getByRole('button',{name:'Partida',exact:true}).click();await expect(page.locator('.decision-topbar-identity small')).toContainText('CICLO 1');await page.locator('#decision [name=quantity]').fill('23');hang=true;await expect.poll(()=>observed,{timeout:6000}).toBe(true);cycle=2;
 await expect(page.locator('.decision-topbar-identity small')).toContainText('CICLO 2',{timeout:16000});await expect(page.locator('#decision [name=quantity]')).toHaveValue('0');await page.waitForTimeout(3500);await expect(page.locator('.decision-topbar-identity small')).toContainText('CICLO 2');
 }finally{await context.close()}
});
test('dos pestañas se sincronizan y una se recupera tras perder conexión',async({browser})=>{
 test.setTimeout(35000);const a=await browser.newContext(),b=await browser.newContext(),pa=await a.newPage(),pb=await b.newPage();let cycle=1,offline=false;
 const game={id:'game',name:'Partida',code:'ABCD1234',cycle_count:3,costs:{basic:50,standard:80,premium:120}};
 const state=n=>({game,isTeacher:false,company:{id:'company',cash:30000},companies:[{id:'company',name:'Empresa',store:'Tienda',cash:30000,inventory:[]}],cycles:[{id:'cycle-'+n,number:n,status:'open',ends_at:new Date(Date.now()+120000).toISOString(),server_now:new Date().toISOString()}],decisions:[],ownDecision:null,results:[],ranking:[{id:'company',name:'Empresa',returnPercent:0}]});
 async function setup(ctx,canLoseConnection){await ctx.route('**/api/**',async route=>{if(canLoseConnection&&offline){await route.abort('internetdisconnected');return}const path=new URL(route.request().url()).pathname;const body=path==='/api/me'?{id:'user',role:'student',display_name:'Alumno'}:path==='/api/games'?[game]:path==='/api/catalog'?[]:path==='/api/games/game'?state(cycle):{};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})})}
 try{await Promise.all([setup(a,true),setup(b,false)]);for(const p of [pa,pb]){await p.goto('http://127.0.0.1:4398');await p.getByRole('button',{name:'Partida',exact:true}).click();await expect(p.locator('.decision-topbar-identity small')).toContainText('CICLO 1')}
 await pa.locator('#decision [name=quantity]').fill('23');offline=true;await expect(pa.locator('#error')).toContainText('Sin conexión',{timeout:9000});cycle=2;await expect(pb.locator('.decision-topbar-identity small')).toContainText('CICLO 2',{timeout:9000});await expect(pa.locator('.decision-topbar-identity small')).toContainText('CICLO 1');offline=false;await expect(pa.locator('.decision-topbar-identity small')).toContainText('CICLO 2',{timeout:9000});await expect(pa.locator('#error')).toContainText('Conexión recuperada');await expect(pa.locator('#decision [name=quantity]')).toHaveValue('0');
 }finally{await Promise.all([a.close(),b.close()])}
});
test('el borrador guardado prevalece sobre valores iniciales sin editar',async({browser})=>{
 test.setTimeout(25000);const ctx=await browser.newContext(),page=await ctx.newPage();let draft=null,decisionRevision=0;
 const game={id:'game',name:'Partida',code:'ABCD1234',cycle_count:3,costs:{basic:50,standard:80,premium:120}};
 function state(){return {game,isTeacher:false,company:{id:'company',cash:30000},companies:[{id:'company',name:'Empresa',store:'Tienda',cash:30000,inventory:[]}],cycles:[{id:'cycle-1',number:1,status:'open',ends_at:new Date(Date.now()+120000).toISOString(),server_now:new Date().toISOString()}],decisions:[],ownDecision:draft,results:[],ranking:[{id:'company',name:'Empresa',returnPercent:decisionRevision}]}}
 await ctx.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;const body=path==='/api/me'?{id:'user',role:'student',display_name:'Alumno'}:path==='/api/games'?[game]:path==='/api/catalog'?[]:path==='/api/games/game'?state():{};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 try{await page.goto('http://127.0.0.1:4398');await page.getByRole('button',{name:'Partida',exact:true}).click();const amount=page.locator('#decision [name=marketingAmount]');await expect(amount).toHaveValue('0');draft={quality:'standard',quantity:12,price:100,marketing_amount:2500,confirmed:false};await expect(amount).toHaveValue('2500',{timeout:8000});await expect(page.locator('#decision [name=quantity]')).toHaveValue('12');await amount.fill('3000');decisionRevision++;await page.waitForTimeout(4500);await expect(amount).toHaveValue('3000');
 }finally{await ctx.close()}
});
test('la confirmación oficial se muestra aunque un sondeo posterior quede pendiente',async({browser})=>{
 test.setTimeout(30000);const ctx=await browser.newContext(),page=await ctx.newPage();let saved=false,getsAfterSave=0;
 const game={id:'game',name:'Partida',code:'ABCD1234',cycle_count:3,costs:{basic:50,standard:80,premium:120}};
 function state(){return {game,isTeacher:false,company:{id:'company',cash:30000},companies:[{id:'company',name:'Empresa',store:'Tienda',cash:30000,inventory:[]}],cycles:[{id:'cycle-1',number:1,status:'open',ends_at:new Date(Date.now()+120000).toISOString(),server_now:new Date().toISOString()}],decisions:[],ownDecision:saved?{quality:'basic',quantity:1,price:100,marketing_amount:0,confirmed:true}:null,results:[],ranking:[{id:'company',name:'Empresa',returnPercent:0}]}}
 await ctx.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/games/game/decision'){saved=true;await route.fulfill({status:200,contentType:'application/json',body:'{}'});return}const body=path==='/api/me'?{id:'user',role:'student',display_name:'Alumno'}:path==='/api/games'?[game]:path==='/api/catalog'?[]:path==='/api/games/game'?state():{};if(path==='/api/games/game'&&saved){getsAfterSave++;await new Promise(r=>setTimeout(r,getsAfterSave===1?2500:10000))}try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})}catch{}});
 try{await page.goto('http://127.0.0.1:4398');await page.getByRole('button',{name:'Partida',exact:true}).click();await page.locator('#decision [name=quantity]').fill('1');await page.waitForTimeout(2000);await page.getByRole('button',{name:'Confirmar decisión'}).click();await expect(page.getByText('Decisión confirmada.')).toBeVisible({timeout:7000});expect(getsAfterSave).toBeGreaterThanOrEqual(2)
 }finally{await ctx.close()}
});
