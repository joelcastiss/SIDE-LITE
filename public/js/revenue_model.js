/* Revenue adapter: the same pure v19 closure supplies all market profiles. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./engine/cierre.js'):root.SIDE_ECONOMIC_CLOSURE);if(node)module.exports=api;else root.SIDE_REVENUE_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(ECON){
  'use strict';
  function profile(input){return ECON.prepare(input);}
  function allocate(inputs){return ECON.allocate(inputs.map(input=>profile(input)));}
  return {profile,allocate};
});
