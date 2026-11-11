// Retired endpoint: automatic closing runs inside PostgreSQL via pg_cron.
// Keep a harmless response at the old URL so an obsolete scheduler cannot
// continue invoking the former JavaScript closer.
Deno.serve(() => new Response('Gone', {status: 410, headers: {'Cache-Control':'no-store'}}));
