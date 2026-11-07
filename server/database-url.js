/** This backend is a local development service, not a Supabase migration tool. */
export function assertLocalDatabase(value){
  let url;try{url=new URL(value)}catch{throw new Error('DATABASE_URL local inválida')}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.searchParams.has('host')||url.searchParams.has('hostaddr')||url.searchParams.has('service'))throw new Error('Este servicio solo admite PostgreSQL local e independiente');
  return value;
}
