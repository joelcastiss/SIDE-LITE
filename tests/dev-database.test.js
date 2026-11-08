import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLiteDevDatabase,devBridgeConnections} from '../remote/dev-database.js';
const host='ep-broad-poetry-bc6rj0kr-pooler.c-16.us-east-1.aws.neon.tech';
const url=`postgresql://test:example@${host}/neondb?sslmode=require&channel_binding=require`;
test('la conexión se limita a los endpoints de SIDE-Lite dev y verifica TLS',()=>{
 const safe=new URL(assertLiteDevDatabase(url,host));assert.equal(safe.hostname,host);assert.equal(safe.searchParams.get('sslmode'),'verify-full');
 for(const input of [url.replace(host,'otro.neon.tech'),url+'&host=otro.neon.tech',url+'&hostaddr=127.0.0.1',url+'&service=other',url+'&options=-csearch_path%3Dpublic',url+'&sslmode=disable',url.replace('/neondb','/postgres'),url.replace('postgresql:','http:')])assert.throws(()=>assertLiteDevDatabase(input,new URL(input).hostname));
 assert.throws(()=>assertLiteDevDatabase(url,'otro.neon.tech'));
});
test('el puente exige identidades de API y cierre separadas y destino autorizado',()=>{
 const api=`postgresql://lite_dev_api:example@${host}/neondb`;
 const closer=`postgresql://lite_dev_closer:example@${host}/neondb`;
 const env={NEON_DEV_DB_HOST:host,NEON_DATABASE_URL:api,NEON_CLOSER_DATABASE_URL:closer};
 assert.equal(new URL(devBridgeConnections(env).api).username,'lite_dev_api');
 assert.equal(new URL(devBridgeConnections(env).closer).username,'lite_dev_closer');
 for(const bad of [
  {...env,NEON_CLOSER_DATABASE_URL:undefined},
  {...env,NEON_CLOSER_DATABASE_URL:api},
  {...env,NEON_DATABASE_URL:closer},
  {...env,NEON_CLOSER_DATABASE_URL:closer.replace(host,'otro.neon.tech')},
  {...env,NEON_CLOSER_DATABASE_URL:closer+'?host=otro.neon.tech'}
 ])assert.throws(()=>devBridgeConnections(bad));
});
