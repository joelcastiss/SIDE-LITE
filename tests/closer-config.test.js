import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCloserConfig} from '../supabase-side-lite/functions/close-cycle/config.js';

test('el cierre identifica la configuración ausente sin registrar sus valores', () => {
  assert.throws(() => validateCloserConfig('', ''), /Missing SIDE_CLOSER_DATABASE_URL/);
  assert.throws(() => validateCloserConfig('db-private', ''), /Missing SIDE_CLOSER_SECRET/);
  assert.throws(() => validateCloserConfig('db-private', 'short'), /Invalid SIDE_CLOSER_SECRET/);
  assert.throws(() => validateCloserConfig('db-private', 'a'.repeat(32) + ' '), /Invalid SIDE_CLOSER_SECRET/);
  assert.throws(() => validateCloserConfig('db-private', 'a'.repeat(32), ''), /Invalid SIDE_CLOSER_CA_CERT/);
  assert.doesNotThrow(() => validateCloserConfig('db-private', 'a'.repeat(32), '-----BEGIN CERTIFICATE-----\nexample\n-----END CERTIFICATE-----'));
});
