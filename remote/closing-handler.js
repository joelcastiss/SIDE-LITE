import {parseTriggerDelivery} from '@neon/functions/triggers';

// This gate relies on the Neon Functions proxy stripping client-supplied
// x-neon-* headers. Do not use this handler behind a different proxy.
export function createClosingHandler(closeDue) {
 return async function fetch(request) {
  if(request.method!=='POST')return new Response('No autorizado',{status:401});
  const result=await parseTriggerDelivery(request);
  if(!result.ok||result.invocation.type!=='schedule'||result.invocation.trigger.name!=='side-lite-close-dev')return new Response('No autorizado',{status:401});
  try{const closed=await closeDue();return Response.json({closed})}
  catch{console.error('Error de cierre');return new Response('Error de cierre',{status:500})}
 };
}
