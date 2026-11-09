// Inactive until independently deployed and scheduled. No HTTP handler is exposed.
const ENDPOINT = 'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/close-cycle';

export async function runSweep(env, {fetcher = fetch, timeoutMs = 15000} = {}) {
  const secret = env?.SIDE_CLOSER_SECRET;
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 512 || /\s/.test(secret)) {
    throw new Error('Invalid scheduler configuration');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(ENDPOINT, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: {'Content-Type':'application/json', 'x-side-cron-secret':secret}, body: '{}',
    });
    if (!response.ok) throw new Error('Cycle sweep returned an error');
    const result = await response.json();
    if (!Number.isSafeInteger(result?.closed) || result.closed < 0 || !Number.isSafeInteger(result?.failed) || result.failed !== 0) {
      throw new Error('Cycle sweep reported a failure');
    }
    return {closed:result.closed, failed:0};
  } catch {
    // Do not include request headers, response bodies or provider errors in logs.
    throw new Error('Scheduled cycle sweep failed');
  } finally {
    clearTimeout(timer);
  }
}

export default {
  scheduled(_event, env, ctx) { ctx.waitUntil(runSweep(env)); },
};
