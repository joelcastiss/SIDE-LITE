/* One-way visual boundary. Providers are owned by 2D; consumers receive only
 * detached, deeply frozen projections. Fun receipts never leave local storage. */
(function(root){
  'use strict';
  const defaults={company:{name:'MI EMPRESA',gameCode:'SIDE',character:'chico2'},cycle:1,products:[],approximateStock:24,storeLevel:{stores:1,visual:{}},news:[],events:[]};
  function copy(value){return JSON.parse(JSON.stringify(value));}
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  let last=freeze(copy(defaults));
  function publish(input){
    try {const clean={};Object.keys(defaults).forEach(key=>{clean[key]=input?.[key]??last[key]??defaults[key];});last=freeze(copy(clean));return true;}
    catch {return false;}
  }
  function getWorldSnapshot(){return freeze(copy(last));}
  function emitFunSale(sale={}){
    const context=String(sale.context||'default').replace(/[^a-z0-9_-]/gi,'_');
    const key='side3d_fun_receipts_'+context;
    let state={customersServed:0,points:0};
    try{state=JSON.parse(root.localStorage?.getItem(key)||'null')||state;}catch{}
    state={customersServed:Math.max(0,Number(state.customersServed)||0)+1,points:Math.max(0,Number(state.points)||0)+Math.max(0,Number(sale.points)||0)};
    try{root.localStorage?.setItem(key,JSON.stringify(state));}catch{}
    return freeze(copy(state));
  }
  root.SIDE_WORLD_BRIDGE=Object.freeze({getWorldSnapshot,emitFunSale});
  // Only 2D lifecycle hooks publish; reads never execute 2D code.
  root.SIDE_WORLD_PUBLISHER=Object.freeze({publish});
})(typeof window==='object'?window:globalThis);
