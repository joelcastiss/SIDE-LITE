import test from 'node:test';import assert from 'node:assert/strict';import {createTurnstileProvider} from '../public/turnstile-provider.js';
test('Turnstile obtiene un token de uso único y retira el widget',async()=>{let options,removed=0,containerRemoved=0;const api={render:(_container,o)=>(options=o,'widget'),execute:()=>queueMicrotask(()=>options.callback('challenge-token')),remove:id=>{assert.equal(id,'widget');removed++}},host={append(){}},doc={querySelector:()=>host,body:host,createElement:()=>({remove(){containerRemoved++}})};const get=createTurnstileProvider({siteKey:'public_site_key_123',document:doc,window:{turnstile:api},timeoutMs:1000});assert.equal(await get(),'challenge-token');assert.equal(options.execution,'execute');assert.equal(options.appearance,'interaction-only');assert.equal(removed,1);assert.equal(containerRemoved,1)});
test('Turnstile falla cerrado al rechazar la verificación',async()=>{let options;const api={render:(_el,o)=>(options=o,'w'),execute:()=>queueMicrotask(()=>options['error-callback']()),remove(){}},host={append(){}},doc={querySelector:()=>host,body:host,createElement:()=>({remove(){}})};const get=createTurnstileProvider({siteKey:'public_site_key_123',document:doc,window:{turnstile:api},timeoutMs:1000});await assert.rejects(get(),/verificar/)});
test('llave ausente no activa CAPTCHA; llave inválida se rechaza',()=>{assert.equal(createTurnstileProvider({siteKey:''}),null);assert.throws(()=>createTurnstileProvider({siteKey:'INVALID?'}),/Configuración/)});

test('preload does not issue a challenge or bypass a fresh token',async()=>{
 let renders=0;
 const api={render:()=>{renders++;return 'widget'},execute(){},remove(){}};
 const verify=createTurnstileProvider({siteKey:'public_site_key_123',window:{turnstile:api}});
 assert.equal(await verify.preload(),api);
 assert.equal(renders,0);
});

test('blocked Turnstile script fails promptly and securely',async()=>{
 let removed=0;
 const doc={createElement:()=>({remove(){removed++}}),head:{append(){}},querySelector:()=>null,body:{append(){}}};
 const verify=createTurnstileProvider({siteKey:'public_site_key_123',document:doc,window:{},scriptTimeoutMs:20});
 await assert.rejects(verify.preload(),/No se pudo cargar la verificación/);
 assert.equal(removed,1);
});
