import { chromium } from '@playwright/test';
import express from 'express';
import fs from 'node:fs';
const out='output/decision-diseno-qa';fs.mkdirSync(out,{recursive:true});
const server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});
const browser=await chromium.launch({headless:true});const all=[];
async function mount(page,seconds=600,skip=true){
 if(skip)await page.addInitScript(()=>localStorage.setItem('SIDE_COACHMARK_V1_student_lite','1'));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForLoadState('domcontentloaded');
 await page.evaluate((seconds)=>{window.__own=null;const now=Date.now();window.SIDLiteGame={getGame:async()=>({game:{id:'g1',name:'demo1',code:'DEMO',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{name:'demo1',cash:30000,store:'Tienda'},cycles:[{id:'c1',number:1,status:'open',server_now:new Date(now).toISOString(),ends_at:new Date(now+seconds*1000).toISOString()}],ownDecision:window.__own,ranking:[],results:[]}),request:async(path,method,payload)=>{window.__own={...payload,marketing_amount:payload.marketingAmount};return {}}};window.SIDELiteDecisions.mount({gameId:'g1',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}})},seconds);
 await page.locator('#enterDecisionsBtn').waitFor({state:'visible'});await page.locator('#enterDecisionsBtn').click();await page.locator('[data-cat="quality"]').waitFor();
}
async function inputValues(page,error=false){await page.locator('.quality-option[data-value="premium"]').click();for(const [key,value] of Object.entries(error?{quantity:'100001',price:'0',marketingAmount:'100'}:{quantity:'200',price:'150',marketingAmount:'1000'})){await page.locator(`[data-cat="${key}"]`).click();await page.locator(`[name="${key}"]`).fill(value)}}
const views=[{width:1280,height:720},{width:1366,height:768},{width:1920,height:1080}],scenarios=['enviada'];
for(const viewport of views)for(const scenario of scenarios){
 const page=await browser.newPage({viewport});const issues=[];page.on('pageerror',e=>issues.push('pageerror: '+e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.type()+': '+m.text())});
 try{await mount(page);if(scenario!=='inicial')await inputValues(page,scenario==='errores');if(scenario==='borrador'||scenario==='enviada'){await page.locator(scenario==='borrador'?'#saveDecisionSection':'#sendDecisionSection').click();await page.waitForFunction(()=>window.__own!==null);await page.waitForTimeout(5300)}
 for(const key of ['quality','quantity','price','marketingAmount']){await page.locator(`[data-cat="${key}"]`).click();await page.waitForTimeout(120);const path=`${out}/${viewport.width}x${viewport.height}-${scenario}-${key}.png`;await page.screenshot({path});const metrics=await page.evaluate(()=>{
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};
 const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
 const scroll=document.querySelector('#decisionFormScroll'),header=document.querySelector('#decisionTopbar'),footer=document.querySelector('.section-save-bar'),panel=[...document.querySelectorAll('#decisionCards .decision-card')].find(visible);
 const children=panel?[...panel.children].filter(visible):[],lastBottom=children.length?Math.max(...children.map(e=>e.getBoundingClientRect().bottom)):0,pr=rect(panel);
 const textNodes=[...document.querySelectorAll('#decisionMenu button')].filter(visible).flatMap(b=>[...b.querySelectorAll('span,strong,small')].filter(e=>visible(e)&&e.textContent.trim()).map(e=>{let x=rect(e),p=rect(b);return {text:e.textContent.trim(),left:x.left-p.left,right:p.right-x.right,scroll:e.scrollWidth,client:e.clientWidth}}));
 const hint=document.querySelector('#decisionProgressHint'),hs=getComputedStyle(hint),badText=(document.querySelector('#decisionMenu')?.innerText||'').match(/S\/\s?\d{1,3}\.\d{3}|0\.0\s?%/g)||[];
 return {pageScroll:document.scrollingElement.scrollHeight,viewport:innerHeight,scrollHeight:scroll.scrollHeight,scrollClient:scroll.clientHeight,scrollRect:rect(scroll),header:rect(header),footer:rect(footer),panel:pr,emptyRatio:pr?(pr.bottom-lastBottom)/pr.height:null,buttons:textNodes,progress:{height:rect(hint).height,lineHeight:hs.lineHeight,whiteSpace:hs.whiteSpace,text:hint.textContent},badText,locked:[...document.querySelectorAll('#decisionCards .decision-card input')].every(x=>x.disabled),bodyText:document.querySelector('#decisionMenu')?.innerText};
 });all.push({viewport,scenario,key,path,metrics,issues:[...issues]});}
 }catch(e){all.push({viewport,scenario,error:String(e),issues})}await page.close();
}
for(const [name,seconds,skip] of []){const page=await browser.newPage({viewport:{width:1366,height:768}});try{await mount(page,seconds,skip);await page.waitForTimeout(500);await page.screenshot({path:`${out}/${name}.png`});all.push({special:name,timer:await page.locator('#decisionRoundTimer').evaluate(e=>({text:e.textContent,class:e.className})),modal:await page.locator('.coach-layer').count()})}catch(e){all.push({special:name,error:String(e)})}await page.close()}
await browser.close();server.closeAllConnections();server.close();fs.writeFileSync(`${out}/metrics-enviada.json`,JSON.stringify(all,null,2));console.log(`Registros: ${all.length}`);
