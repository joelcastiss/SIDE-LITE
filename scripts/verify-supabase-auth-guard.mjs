// Read-only preflight: never print configuration values or credentials.
import {pathToFileURL} from 'node:url';
export function auditAuthGuard(config){
 const problems=[];
 if(config?.external_anonymous_users_enabled!==true)problems.push('Auth anónimo desactivado');
 if(!Number.isInteger(config?.rate_limit_anonymous_users)||config.rate_limit_anonymous_users<1)problems.push('Límite IP de identidades anónimas ausente o inválido');
 if(config?.security_sb_forwarded_for_enabled===true)problems.push('Revisar uso de IP reenviada: verificar proxy de confianza y clave secreta');
 return problems;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const token=process.env.SIDE_LITE_SUPABASE_MANAGEMENT_TOKEN;if(!token)throw Error('Falta SIDE_LITE_SUPABASE_MANAGEMENT_TOKEN de solo lectura');
 const response=await fetch('https://api.supabase.com/v1/projects/hwwwoblfpsqqrkxvclag/config/auth',{headers:{Authorization:`Bearer ${token}`},redirect:'error'});if(!response.ok)throw Error(`Consulta de configuración falló (${response.status})`);
 const problems=auditAuthGuard(await response.json());if(problems.length){for(const problem of problems)console.error(`PENDIENTE: ${problem}`);process.exitCode=1}else console.log('Auth anónimo y límite IP configurados; verificar además origen y prueba real.');
}
