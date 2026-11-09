import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDatabaseTarget} from '../supabase-side-lite/functions/database-target.js';

test('las conexiones privilegiadas solo aceptan el destino SIDE-LITE confirmado', () => {
  const accepted = [
    'postgresql://api:password@db.hwwwoblfpsqqrkxvclag.supabase.co:5432/postgres',
    'postgresql://closer.hwwwoblfpsqqrkxvclag:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ];
  for (const url of accepted) assert.equal(validateDatabaseTarget(url),url);
  for (const url of [
    'postgresql://api:password@localhost/postgres',
    'postgresql://api:password@db.otherproject.supabase.co/postgres',
    'postgresql://closer.otherproject:password@aws-0-us-east-1.pooler.supabase.com/postgres',
    'postgresql://api:password@db.hwwwoblfpsqqrkxvclag.supabase.co/postgres?sslmode=disable',
    'postgresql://api@db.hwwwoblfpsqqrkxvclag.supabase.co/postgres',
    'https://api:password@db.hwwwoblfpsqqrkxvclag.supabase.co/postgres',
    'invalid',
  ]) assert.throws(() => validateDatabaseTarget(url), /Conexión SIDE-LITE inválida/);
});
