// Restrict privileged server-side connections to the dedicated SIDE-LITE project.
// A separate build and reviewed configuration are required for isolated branches.
const PROJECT_REF = 'hwwwoblfpsqqrkxvclag';

export function validateDatabaseTarget(raw) {
  let connection;
  try { connection = new URL(raw); } catch { throw new Error('Conexión SIDE-LITE inválida'); }
  let username;
  try { username = decodeURIComponent(connection.username); } catch { throw new Error('Conexión SIDE-LITE inválida'); }
  const direct = connection.hostname === `db.${PROJECT_REF}.supabase.co`;
  const pooler = connection.hostname.endsWith('.pooler.supabase.com') && username.endsWith(`.${PROJECT_REF}`);
  if (!['postgres:', 'postgresql:'].includes(connection.protocol) || (!direct && !pooler) || !username || !connection.password || connection.search || connection.hash) {
    throw new Error('Conexión SIDE-LITE inválida');
  }
  return raw;
}
