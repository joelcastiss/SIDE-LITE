import {test, expect} from '@playwright/test';
import express from 'express';
let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
test('una recuperación estudiantil antigua no interrumpe el acceso docente',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('side-lite-guest-last',JSON.stringify({gameId:'old',code:'ABCDE'}));localStorage.setItem('side-lite-guest-old',JSON.stringify({code:'ABCDE',secret:'x'}));});
 await page.goto(base+'/index.html');
 await page.evaluate(async()=>{
  localStorage.setItem('side-lite-guest-last',JSON.stringify({gameId:'old',code:'ABCDE'}));
  localStorage.setItem('side-lite-guest-old',JSON.stringify({code:'ABCDE',secret:'x'}));
  window.testMounts=0;window.testJoins=0;
  window.SIDLiteGame.joinGame=()=>{window.testJoins++;return new Promise(resolve=>window.finishJoin=()=>resolve({game_id:'old'}))};
  window.SIDELiteDecisions.mount=async()=>{window.testMounts++};
 });
 expect(await page.evaluate(()=>window.testJoins)).toBe(0);
 await page.locator('[data-profile=student]').dispatchEvent('click');
 expect(await page.evaluate(()=>window.testJoins)).toBe(0);
 await page.locator('#studentForm').dispatchEvent('submit');
 await expect.poll(()=>page.evaluate(()=>window.testJoins)).toBe(1);
 await page.locator('[data-profile=teacher]').dispatchEvent('click');
 await page.evaluate(()=>window.finishJoin());
 await expect.poll(()=>page.evaluate(()=>window.testMounts)).toBe(0);
 await expect(page.locator('#teacherLoginModal')).not.toHaveClass(/hidden/);
});
