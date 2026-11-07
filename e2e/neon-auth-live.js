// Disabled: old test created .invalid accounts and cannot prove real verification.
throw new Error('Prueba deshabilitada: se requieren cuentas institucionales verificadas reales.');
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createIdentityVerifier} from '../remote/identity.js';
const base=process.env.NEON_AUTH_BASE_URL;if(!base)throw Error('NEON_AUTH_BASE_URL requerida');
const email=`lite-test-${crypto.randomUUID()}@example.invalid`,password=crypto.randomBytes(32).toString('base64url');
const req=(path,body,cookie)=>fetch(base+path,{method:body?'POST':'GET',headers:{origin:'http://localhost:4178',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
const signup=await req('/sign-up/email',{email,password,name:'SIDE Lite prueba'});assert.equal(signup.status,200,'registro de prueba');
const login=await req('/sign-in/email',{email,password});assert.equal(login.status,200,'inicio de sesión');
const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');const session=await req('/get-session',undefined,cookie);assert.equal(session.status,200);assert.ok((await session.json())?.user?.id,'sesión restaurada');
const response=await req('/token',undefined,cookie);assert.equal(response.status,200);const {token}=await response.json();assert.ok(token);const verify=createIdentityVerifier({authBaseUrl:base,jwksUrl:base+'/.well-known/jwks.json'});assert.ok((await verify('Bearer '+token)).subject);
if(process.env.SIDE_LITE_DEV_API){const blocked=await fetch(process.env.SIDE_LITE_DEV_API+'/api/me',{headers:{authorization:'Bearer '+token}});assert.equal(blocked.status,403,'correo sin verificar rechazado por defecto')}
const logout=await req('/sign-out',{},cookie);assert.equal(logout.status,200);const after=await req('/get-session',undefined,cookie);assert.equal(await after.json(),null,'sesión revocada');console.log('PASS: Neon Auth registro, acceso, sesión, token y salida en rama de desarrollo');
