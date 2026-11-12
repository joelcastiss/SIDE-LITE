import {test, expect} from '@playwright/test';
import express from 'express';

let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));

test('recupera la partida docente después de una indisponibilidad temporal',async({page})=>{
  let attempts=0;
  await page.addInitScript(()=>sessionStorage.setItem('side-lite-teacher-game','game1'));
  await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
  await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
    const path=new URL(route.request().url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(path==='/games/game1' && ++attempts<=3)return route.fulfill({status:503,headers,json:{error:'Indisponible'}});
    const game={id:'game1',teacher_id:'teacher',code:'A7K2M',name:'Prueba',cycle_count:3,enabled_events:[],costs:{basic:50,standard:80,premium:120}};
    const json=path==='/me'?{id:'teacher',display_name:'Docente',role:'teacher'}:path==='/catalog'?[]:path==='/games'?[game]:path==='/games/game1'?{isTeacher:true,game,companies:[],decisions:[],results:[],ranking:[],cycles:[]}:[];
    return route.fulfill({status:200,headers,json});
  });
  await page.goto(base+'/docente.html');
  await expect.poll(()=>attempts,{timeout:12000}).toBeGreaterThanOrEqual(4);
  await expect(page.locator('#gameCodeBadge')).toContainText('A7K2M');
  expect(await page.evaluate(()=>sessionStorage.getItem('side-lite-teacher-game'))).toBe('game1');
});
