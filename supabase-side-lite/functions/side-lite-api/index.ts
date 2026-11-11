import pg from 'npm:pg@8.23.1';
import postgres from 'npm:postgres@3.4.7';
import {createSideLiteApp} from '../../api/app.js';
import {createEdgeHandler} from './adapter.js';
import {validateDatabaseTarget} from '../database-target.js';
import {closeOne} from '../close-cycle/worker.js';

// Only a dedicated server-side login for this project is accepted. A public or
// service key is never accepted as a database connection string.
const raw = Deno.env.get('SIDE_API_DATABASE_URL');
if (!raw) throw new Error('SIDE_API_DATABASE_URL no configurada');
const ref = 'hwwwoblfpsqqrkxvclag';
validateDatabaseTarget(raw);
const pool = new pg.Pool({connectionString:raw, ssl:{rejectUnauthorized:true}, max:1, idleTimeoutMillis:10000, connectionTimeoutMillis:10000});
const closerUrl=Deno.env.get('SIDE_CLOSER_DATABASE_URL') || '';
const closerCa=Deno.env.get('SIDE_CLOSER_CA_CERT') || '';
if(!closerUrl || !closerCa.includes('-----BEGIN CERTIFICATE-----') || !closerCa.includes('-----END CERTIFICATE-----')) throw new Error('Cierre asistido no configurado');
validateDatabaseTarget(closerUrl);
const closer=postgres(closerUrl,{ssl:{ca:closerCa,rejectUnauthorized:true},max:1,prepare:false,idle_timeout:10,connect_timeout:10});
const app = createSideLiteApp({pool, projectUrl:`https://${ref}.supabase.co`,manualClose:(gameId:string)=>closeOne(closer,[],gameId)});
export default {fetch:createEdgeHandler(app)};
