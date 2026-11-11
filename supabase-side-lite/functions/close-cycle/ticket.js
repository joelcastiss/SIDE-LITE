// A ticket is valid once, for at most 60 seconds. Only its digest is stored.
// DELETE is atomic across concurrent Edge invocations; the database clock is
// authoritative and a failed database operation fails closed.
export async function consumeTicket(sql, ticket) {
  if (!/^[0-9a-f]{64}$/.test(ticket)) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ticket)));
  const rows = await sql`delete from side_lite_private.lite_closer_tickets
    where token_hash = ${digest} and expires_at > clock_timestamp()
    returning token_hash`;
  return rows.length === 1;
}
