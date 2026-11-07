import {createRemoteJWKSet,jwtVerify} from 'jose';
/** Verification only: callers must still authorize the returned identity against game ownership. */
export function createIdentityVerifier({authBaseUrl,jwksUrl,keySet}={}){
  const base=new URL(authBaseUrl), keys=new URL(jwksUrl);
  if(base.protocol!=='https:'||keys.protocol!=='https:'||base.origin!==keys.origin)throw new Error('Configuración Neon Auth inválida');
  const issuer=base.origin, jwks=keySet??createRemoteJWKSet(keys);
  return async authorization=>{
    const match=typeof authorization==='string'&&/^Bearer ([^\s]+)$/i.exec(authorization);
    if(!match)throw new Error('No autorizado');
    try{const {payload}=await jwtVerify(match[1],jwks,{issuer,audience:issuer,algorithms:['EdDSA'],maxTokenAge:'15m',clockTolerance:30,requiredClaims:['sub','exp','iat','aud']});if(typeof payload.sub!=='string'||!payload.sub.trim())throw new Error('Identidad inválida');return {subject:payload.sub,emailVerified:payload.emailVerified===true,banned:payload.banned===true}}catch{throw new Error('No autorizado')}
  };
}
