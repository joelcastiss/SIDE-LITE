(function(g){'use strict';
function client(){const c=g.SIDE?.SupabaseClient?.get();if(!c)throw Error('Supabase no está disponible.');return c;}
async function auth(){const c=client(),{data,error}=await c.auth.getUser();if(error)throw error;if(!data?.user)throw Error('Inicia sesión como docente para consultar el laboratorio.');return c;}
async function games(){const c=await auth(),{data,error}=await c.from('partidas').select('id,nombre,codigo').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data||[];}
async function companies(game){const c=await auth(),{data,error}=await c.from('participantes').select('empresa_id,empresa,nombre_comercial_ingreso').eq('partida_id',game).not('empresa_id','is',null).order('created_at').limit(200);if(error)throw error;return data||[];}
async function closure(game,cycle){const c=await auth(),{data,error}=await c.rpc('side_consultar_cierre_negocio',{p_partida_id:game,p_ciclo:Number(cycle)});if(error)throw error;if(data?.error)throw Error(data.error);return data?.cierre||null;}
g.SIDE_LAB_SERVICE={games,companies,closure};
})(window);
