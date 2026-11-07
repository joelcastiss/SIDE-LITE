import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const c=JSON.parse(await readFile('.neon-dev-secrets.json','utf8'));
const url='https://br-snowy-moon-bcshnyw2-sidepreview.compute.c-16.us-east-1.aws.neon.tech/api/games';
let r=await fetch(url);assert.equal(r.status,401,'sin clave');
r=await fetch(url,{headers:{'x-side-preview':c.LITE_PREVIEW_KEY}});assert.equal(r.status,401,'sin token');
r=await fetch(url,{headers:{'x-side-preview':c.LITE_PREVIEW_KEY,'authorization':'Bearer invalid'}});assert.equal(r.status,401,'token falso');
console.log('PASS: API HTTPS Neon exige clave privada y rechaza tokens inválidos');
