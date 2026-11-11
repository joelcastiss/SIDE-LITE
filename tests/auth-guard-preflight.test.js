import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAuthGuard} from '../scripts/verify-supabase-auth-guard.mjs';
const valid={external_anonymous_users_enabled:true,rate_limit_anonymous_users:30,security_sb_forwarded_for_enabled:false};
test('auditoría comprueba límite IP y proxy',()=>{assert.deepEqual(auditAuthGuard(valid),[]);assert.ok(auditAuthGuard({...valid,rate_limit_anonymous_users:0}).length);assert.ok(auditAuthGuard({...valid,security_sb_forwarded_for_enabled:true}).length)});
