import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('tests/output/neon-function',{recursive:true});
await build({entryPoints:['remote/closing-function.js'],bundle:true,platform:'node',target:'node24',format:'esm',outfile:'tests/output/neon-function/index.mjs',banner:{js:"import{createRequire as __cr}from'module';import{fileURLToPath as __f}from'url';import{dirname as __d}from'path';const require=__cr(import.meta.url);const __filename=__f(import.meta.url);const __dirname=__d(__filename);"}});
console.log('Función compilada en tests/output/neon-function/index.mjs');
