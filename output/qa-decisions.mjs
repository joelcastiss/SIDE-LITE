import { chromium } from '@playwright/test';
import express from 'express';
import fs from 'node:fs';
const server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});
const browser=await chromium.launch({headless:true}); const results=[];
fs.mkdirSync('output/decision-qa',{recursive:true});
for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1920,height:1080}]){
 const page=await browser.newPage({viewport}); const consoleIssues=[];
 page.on('pageerror',e=>consoleIssues.push('error: '+e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleIssues.push(m.type()+': '+m.text())});
 await page.addInitScript(()=>localStorage.setItem('SIDE_COACHMARK_V1_student_lite','1'));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
 await page.evaluate(()=>{const now=Date.now();window.SIDLiteGame={getGame:async()=>({game:{id:'g1',name:'demo1',code:'DEMO',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{name:'demo1',cash:30000,store:'Tienda'},cycles:[{id:'c1',number:1,status:'open',server_now:new Date(now).toISOString(),ends_at:new Date(now+600000).toISOString()}],ownDecision:null,ranking:[],results:[]}),request:async()=>({})};window.SIDELiteDecisions.mount({gameId:'g1',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}})});
 await page.locator('#enterDecisionsBtn').waitFor({state:'visible'}); await page.locator('#enterDecisionsBtn').click();
 for(const key of ['quality','quantity','price','marketingAmount']){
  await page.locator(`[data-cat="${key}"]`).click();await page.waitForTimeout(150);
  const metrics=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};const footer=document.querySelector('.section-save-bar'),fr=rect(footer);const scroll=document.querySelector('#decisionFormScroll'),sr=rect(scroll);const impact=document.querySelector('.lite-impact'),ir=rect(impact);const tabs=[...document.querySelectorAll('#decisionTabs button')].map(el=>{const s=el.querySelector('span'),cs=getComputedStyle(s);return {text:s.textContent,height:s.getBoundingClientRect().height,lineHeight:cs.lineHeight,whiteSpace:cs.whiteSpace}});const opts=[...document.querySelectorAll('.quality-option')].map(el=>({text:getComputedStyle(el.querySelector('strong')).color,description:getComputedStyle(el.querySelector('small')).color,bg:getComputedStyle(el).backgroundColor,backgroundImage:getComputedStyle(el).backgroundImage,opacity:getComputedStyle(el).opacity}));return {pageScroll:document.scrollingElement.scrollHeight,innerHeight,footer:fr,scroll:sr,scrollHeight:scroll.scrollHeight,scrollClient:scroll.clientHeight,scrollOverflow:getComputedStyle(scroll).overflowY,impact:ir,tabs,opts,header:rect(document.querySelector('#decisionTopbar')),head:rect(document.querySelector('#decisionStickyHead')),detail:[...document.querySelectorAll('#decisionDetail, .section-save-bar, .section-save-bar > *, .decision-action-pair > *')].map(e=>({sel:e.className,r:rect(e),width:e.getBoundingClientRect().width,display:getComputedStyle(e).display,flex:getComputedStyle(e).flexDirection,grid:getComputedStyle(e).gridTemplateColumns}))}});
  const path=`output/decision-qa/${viewport.width}x${viewport.height}-${key}.png`;await page.screenshot({path});results.push({viewport,key,metrics,consoleIssues:[...consoleIssues],path});
 }
 await page.close();
}
await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync('output/decision-qa/metrics.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
