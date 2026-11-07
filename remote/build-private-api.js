import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('tests/output/private-api',{recursive:true});
await build({entryPoints:['remote/private-api-function.js'],bundle:true,platform:'node',target:'node24',format:'esm',outfile:'tests/output/private-api/index.mjs',banner:{js:"import{createRequire as __cr}from'module';import{fileURLToPath as __f}from'url';import{dirname as __d}from'path';const require=__cr(import.meta.url);const __filename=__f(import.meta.url);const __dirname=__d(__filename);"}});
console.log('API privada compilada');
