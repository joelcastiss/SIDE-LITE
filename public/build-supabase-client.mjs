import {build} from 'esbuild';
await build({entryPoints:['public/supabase-client-entry.js'],outfile:'public/supabase-client.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'inline'});
