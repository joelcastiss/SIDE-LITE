(function characterSelectionModule(global){
  'use strict';

  const STORAGE_KEY='SIDE_SELECTED_CHARACTER';
  const CHARACTERS=Object.freeze({miguel:'MIGUEL',joel:'JOEL',gonzalo:'GONZALO',valeria:'VALERIA'});
  let selected=null;
  let initialized=false;
  let options={};
  let root=null;
  let cards=[];
  let confirmButton=null;
  let status=null;
  let previousFocus=null;
  let activeStorageKey=STORAGE_KEY;

  function safeRead(){
    try{
      const value=global.localStorage?.getItem(options.storageKey||STORAGE_KEY);
      return Object.prototype.hasOwnProperty.call(CHARACTERS,value)?value:null;
    }catch(error){return null;}
  }

  function safeWrite(value){
    if(options.persist===false)return;
    try{global.localStorage?.setItem(options.storageKey||STORAGE_KEY,value);}catch(error){
      console.warn('SIDE: no se pudo guardar la selección de personaje.',error);
    }
  }

  function render(){
    cards.forEach(card=>{
      const active=card.dataset.character===selected;
      card.setAttribute('aria-pressed',String(active));
      const hint=card.querySelector('small');
      if(hint)hint.textContent=active?'SELECCIONADO':'Seleccionar personaje';
    });
    if(confirmButton)confirmButton.disabled=!selected;
    const strong=status?.querySelector('strong');
    if(strong)strong.textContent=selected?CHARACTERS[selected]:'NINGUNO';
  }

  function select(character,{focus=false,announce=true}={}){
    const normalized=String(character||'').toLowerCase();
    if(!Object.prototype.hasOwnProperty.call(CHARACTERS,normalized))return false;
    selected=normalized;
    safeWrite(selected);
    render();
    const card=cards.find(item=>item.dataset.character===selected);
    if(focus)card?.focus();
    if(announce&&typeof options.onSelectionChange==='function')options.onSelectionChange(selected);
    root?.dispatchEvent(new CustomEvent('side:character-selected',{bubbles:true,detail:{character:selected}}));
    return true;
  }

  function onCardClick(event){select(event.currentTarget.dataset.character);}

  function onGridKeydown(event){
    const index=cards.indexOf(document.activeElement);
    if(index<0)return;
    let next=index;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%cards.length;
    else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index-1+cards.length)%cards.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=cards.length-1;
    else return;
    event.preventDefault();
    cards[next].focus();
  }

  function confirm(){
    if(!selected)return null;
    safeWrite(selected);
    const detail={character:selected};
    root?.dispatchEvent(new CustomEvent('side:character-confirmed',{bubbles:true,detail}));
    if(typeof options.onConfirm==='function')options.onConfirm(selected);
    return selected;
  }

  function init(initOptions={}){
    const nextStorageKey=initOptions.storageKey||options.storageKey||STORAGE_KEY;
    const storageChanged=nextStorageKey!==activeStorageKey;
    options={...options,...initOptions};
    activeStorageKey=nextStorageKey;
    if(initialized){
      if(storageChanged){selected=safeRead();render();}
      if(initOptions.initialSelection)select(initOptions.initialSelection,{announce:false});
      return api;
    }
    root=document.getElementById('characterSelection');
    if(!root)return api;
    cards=Array.from(root.querySelectorAll('[data-character]'));
    confirmButton=document.getElementById('confirmCharacterBtn');
    status=document.getElementById('characterSelectionStatus');
    cards.forEach(card=>card.addEventListener('click',onCardClick));
    document.getElementById('characterSelectionGrid')?.addEventListener('keydown',onGridKeydown);
    confirmButton?.addEventListener('click',confirm);
    initialized=true;
    const initial=initOptions.initialSelection||safeRead();
    if(initial)select(initial,{announce:false});
    else render();
    return api;
  }

  function open(openOptions={}){
    init(openOptions);
    if(!root)return false;
    previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden','false');
    const active=cards.find(card=>card.dataset.character===selected);
    global.requestAnimationFrame(()=>((active||cards[0])?.focus()));
    return true;
  }

  function close(){
    if(!root)return false;
    root.classList.add('hidden');
    root.setAttribute('aria-hidden','true');
    if(previousFocus?.isConnected)previousFocus.focus();
    previousFocus=null;
    return true;
  }

  function getSelected(){return selected;}

  const api=Object.freeze({init,open,close,getSelected,confirm,select,characters:CHARACTERS,storageKey:STORAGE_KEY});
  global.CharacterSelection=api;
  global.SIDECharacterSelection=api;
})(window);
