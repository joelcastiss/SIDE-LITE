import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';
test.use({channel:'chrome'});
test('BFF rechaza una identidad bloqueada con sesión abierta',async({browser})=>{
 test.skip(process.env.SIDE_LITE_BFF_LIVE!=='1','Requiere Neon de desarrollo');test.setTimeout(90000);
 const c=JSON.parse(await readFile('.neon-dev-secrets.json','utf8')),u=JSON.parse(await readFile('tests/output/private-api/dev-identities.json','utf8'))[1];
 const ctx=await browser.newContext({httpCredentials:{username:'side-lite',password:c.LITE_BFF_GATE_KEY}});
 try{const page=await ctx.newPage();await page.goto('https://br-snowy-moon-bcshnyw2-sideweb.compute.c-16.us-east-1.aws.neon.tech');await page.locator('#login [name=email]').fill(u.email);await page.locator('#login [name=password]').fill(u.password);await page.locator('#login button').click();await expect(page.getByRole('heading',{name:'Mis partidas'})).toBeVisible({timeout:30000});console.log('BFF_READY_FOR_BLOCK');await expect.poll(async()=>page.evaluate(async()=>{const r=await fetch('/api/me');return r.status===401||r.status===403}),{timeout:45000,intervals:[1000]}).toBe(true)}finally{await ctx.close()}
});
