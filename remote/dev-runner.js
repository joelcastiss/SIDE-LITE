// Reads a single JSON line from standard input so credentials need not be passed in command arguments.
import {createInterface} from 'node:readline';
const input=createInterface({input:process.stdin,terminal:false});
const line=await new Promise(resolve=>input.once('line',resolve));input.close();
const settings=JSON.parse(line);for(const key of ['NEON_DATABASE_URL','NEON_DEV_DB_HOST','NEON_AUTH_BASE_URL','NEON_AUTH_JWKS_URL','SIDE_LITE_NEON_DEV_ONLY','PORT'])if(settings[key])process.env[key]=settings[key];
await import('./dev-server.js');
