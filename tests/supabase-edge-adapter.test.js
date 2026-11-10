import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {generateKeyPair, SignJWT} from 'jose';
import {createEdgeHandler} from '../supabase-side-lite/functions/side-lite-api/adapter.js';
import {createSideLiteApp} from '../supabase-side-lite/api/app.js';

test('Edge enruta a Express y conserva autorización y cuerpo', async () => {
  const app=express(); app.use(express.json());
  app.post('/api/games', (req,res)=>res.status(201).json({token:req.get('authorization'),body:req.body}));
  const handle=createEdgeHandler(app);
  const result=await handle(new Request('https://example.invalid/functions/v1/side-lite-api/api/games', {method:'POST',headers:{origin:'https://joelcastiss.github.io',authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify({name:'partida'})}));
  assert.equal(result.status,201);
  assert.equal(result.headers.get('access-control-allow-origin'),'https://joelcastiss.github.io');
  assert.deepEqual(await result.json(),{token:'Bearer token',body:{name:'partida'}});
});

test('la función conserva la verificación real del token y la identidad del servidor', async () => {
  const user='c529fd8d-6cec-4c01-9c18-16c079112e23', session='773d8048-bdeb-4bfb-973b-a0a808183235';
  const project='https://hwwwoblfpsqqrkxvclag.supabase.co';
  const {privateKey,publicKey}=await generateKeyPair('ES256');
  const token=await new SignJWT({role:'authenticated',session_id:session}).setProtectedHeader({alg:'ES256'}).setSubject(user).setIssuer(project+'/auth/v1').setAudience('authenticated').setExpirationTime('5m').sign(privateKey);
  const pool={query:async sql=>({rows:[/api_mfa_ready/.test(sql)?{allowed:true}:{id:user,display_name:'Ana',email_verified:true,teacher_authorized:false,session_active:true,banned:false}]}),connect:async()=>{throw Error('unexpected transaction')}};
  const handle=createEdgeHandler(createSideLiteApp({pool,projectUrl:project,keyResolver:async()=>publicKey}));
  const url='https://example.invalid/functions/v1/side-lite-api/api/me';
  assert.equal((await handle(new Request(url))).status,401);
  assert.equal((await handle(new Request(url,{headers:{authorization:'Bearer altered'}}))).status,401);
  const valid=await handle(new Request(url,{headers:{authorization:`Bearer ${token}`}}));
  assert.equal(valid.status,200);
  assert.deepEqual(await valid.json(),{id:user,display_name:'Ana',role:'student'});
});

test('Edge restringe CORS, preflight, rutas y métodos', async () => {
  const handle=createEdgeHandler((req,res)=>res.end('ok'));
  const url='https://example.invalid/side-lite-api/api/games';
  const preflight=await handle(new Request(url,{method:'OPTIONS',headers:{origin:'https://joelcastiss.github.io','access-control-request-method':'POST','access-control-request-headers':'authorization, content-type, apikey'}}));
  assert.equal(preflight.status,204);
  assert.match(preflight.headers.get('access-control-allow-headers'),/apikey/);
  assert.equal((await handle(new Request(url,{headers:{origin:'https://evil.example'}}))).status,403);
  assert.equal((await handle(new Request(url,{method:'OPTIONS',headers:{origin:'https://joelcastiss.github.io','access-control-request-method':'DELETE'}}))).status,403);
  assert.equal((await handle(new Request(url,{method:'DELETE'}))).status,405);
  assert.equal((await handle(new Request('https://example.invalid/other/api/games'))).status,404);
});
