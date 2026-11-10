import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
for(const width of [1440,390]) test(`carrusel original en sala de espera ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const company={id:'co',name:'Empresa',store:'Tienda',cash:30000,initial_capital:30000,inventory:[]};
 const game={id:'g',name:'Partida',code:'ABC123',cycle_count:3,costs:{basic:50,standard:80,premium:120}};
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;route.fulfill({json:path.endsWith('/me')?{id:'u',role:'student',name:'Ana'}:path.endsWith('/catalog')?[]:path.endsWith('/games/g')?{game,isTeacher:false,company,companies:[company],cycles:[],results:[],ranking:[]}:path.endsWith('/games')?[game]:{}})});
 await page.goto(base);await page.getByRole('button',{name:'Partida',exact:true}).click();
 await expect(page.locator('#waitingTutorialMount .tutorial-slide')).toHaveCount(6);await expect(page.locator('#tutorialCurrent')).toHaveText('1');
 await page.locator('#tutorialNext').click();await expect(page.locator('#tutorialCurrent')).toHaveText('2');await expect(page.locator('#tutorialProgressFill')).not.toHaveCSS('width','0px');
 await expect(page.locator('#waitingTutorialMount')).toContainText('CALIDAD');await expect(page.locator('#waitingTutorialMount')).toContainText('MARKETING');
});
