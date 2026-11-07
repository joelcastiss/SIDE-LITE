// Read-only verification of the managed development Auth API contract; sends no email.
import assert from 'node:assert/strict';
const auth='https://ep-broad-poetry-bc6rj0kr.neonauth.c-16.us-east-1.aws.neon.tech/neondb/auth';
const response=await fetch(auth+'/open-api/generate-schema',{signal:AbortSignal.timeout(15000)});
assert.equal(response.status,200,'Neon Auth no publicó su contrato');
const schema=await response.json();
const endpoints=[['/sign-up/email','post',['name','email','password']],['/sign-in/email','post',['email','password']],['/sign-out','post',[]],['/get-session','get',[]],['/token','get',[]],['/email-otp/verify-email','post',['email','otp']],['/email-otp/send-verification-otp','post',['email','type']]];
for(const [path,method,fields] of endpoints){
 const operation=schema.paths?.[path]?.[method];assert.ok(operation,`${method} ${path} no está publicado`);
 const required=operation.requestBody?.content?.['application/json']?.schema?.required||[];
 for(const field of fields)assert.ok(required.includes(field),`${path} no exige ${field}`);
}
console.log('PASS: Neon Auth de desarrollo publica los siete endpoints y campos requeridos. No se envió correo.');
