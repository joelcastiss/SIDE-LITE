const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const CHARACTER_ANIMATION_STATES=Object.freeze({
  IDLE:'IDLE',
  WALK:'WALK',
  RUN:'RUN',
  TALK:'TALK',
  INTERACTION:'INTERACTION',
  AIRBORNE:'AIRBORNE'
});

export const CHARACTER_ANIMATION_PROVIDERS=Object.freeze({
  motionCapture:Object.freeze({
    name:'Ready Player Me animation-library',
    repository:'https://github.com/readyplayerme/animation-library',
    bundledAssets:false,
    integration:'Clips are injected by the caller after rig compatibility or retargeting is verified.'
  }),
  proceduralFallback:Object.freeze({
    name:'SIDE npc_motion',
    module:'services/npc_motion.js',
    bundledAssets:false,
    integration:'Distance-driven procedural motion; it does not create an AnimationMixer or a render loop.'
  })
});

const DEFAULT_ALIASES=Object.freeze({
  IDLE:['idle','standing idle','stand idle'],
  WALK:['walk','walking','locomotion walk'],
  RUN:['run','running','jog','locomotion run'],
  TALK:['talk','talking','speaking'],
  INTERACTION:['interaction','interact'],
  AIRBORNE:['airborne','jump','fall','falling']
});

// Match SIDE's actual on-foot target speeds. Authorised clips can override
// these values with their measured root-motion speeds when registered.
const DEFAULT_SPEEDS=Object.freeze({walk:2.65,run:5.2});
const normalizeName=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
const normalizeState=value=>{
  const state=String(value??'').trim().toUpperCase();
  return Object.hasOwn(CHARACTER_ANIMATION_STATES,state)?state:null;
};
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function clipName(clip){return clip?.name||clip?.getClip?.()?.name||''}

/**
 * Adapts SIDE's existing npc_motion animator to the controller contract.
 * The caller supplies the imported module functions to keep this file free of
 * Three.js and DOM dependencies, which also makes the fallback unit-testable.
 */
export function createNpcMotionAdapter({group,animateNpc,resetMotion,metadata={}}={}){
  if(!group||typeof animateNpc!=='function')return null;
  let state=CHARACTER_ANIMATION_STATES.IDLE,disposed=false;
  return {
    metadata:{...CHARACTER_ANIMATION_PROVIDERS.proceduralFallback,...metadata},
    supports(nextState){return Boolean(normalizeState(nextState))},
    transitionTo(nextState){
      const normalized=normalizeState(nextState);
      if(normalized)state=normalized;
      return Boolean(normalized);
    },
    update(dt,context={}){
      if(disposed)return;
      const active=context.state||state;
      const moving=active===CHARACTER_ANIMATION_STATES.WALK||active===CHARACTER_ANIMATION_STATES.RUN;
      animateNpc(group,clamp(finite(dt),0,.1),moving);
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      if(typeof resetMotion==='function')resetMotion(group);
    }
  };
}

export class CharacterAnimationController{
  constructor({
    mixer=null,
    clips=[],
    actions={},
    interactions={},
    fallback=null,
    fadeDuration=.24,
    walkThreshold=.08,
    runThreshold=3.2,
    referenceSpeeds=DEFAULT_SPEEDS,
    timeScaleRange=[.65,1.45],
    aliases={},
    hooks={},
    metadata={}
  }={}){
    this.mixer=mixer;
    this.fadeDuration=Math.max(0,finite(fadeDuration,.24));
    this.walkThreshold=Math.max(0,finite(walkThreshold,.08));
    this.runThreshold=Math.max(this.walkThreshold,finite(runThreshold,3.2));
    this.referenceSpeeds={...DEFAULT_SPEEDS,...referenceSpeeds};
    this.timeScaleRange=[finite(timeScaleRange?.[0],.65),finite(timeScaleRange?.[1],1.45)].sort((a,b)=>a-b);
    this.aliases={...DEFAULT_ALIASES,...aliases};
    this.hooks={...hooks};
    this.metadata={
      provider:CHARACTER_ANIMATION_PROVIDERS.motionCapture,
      fallback:fallback?.metadata||null,
      ...metadata
    };
    this.fallback=fallback;
    this.state=null;
    this.previousState=null;
    this.activeAction=null;
    this.activeClip=null;
    this.activeInteraction=null;
    this.speed=0;
    this.disposed=false;
    this._clips=new Map();
    this._actions=new Map();
    this._interactions=new Map();
    this._fallbackActive=false;
    this._loadActions(actions);
    this._loadClips(clips);
    this._loadInteractions(interactions);
  }

  _emit(name,payload){
    try{return this.hooks[name]?.(payload,this)}
    catch(error){this.hooks.onError?.({error,hook:name},this);return undefined}
  }

  _loadActions(actions){
    const entries=actions instanceof Map?[...actions]:Object.entries(actions||{});
    for(const [state,action] of entries)this.registerAction(state,action);
  }

  _loadClips(clips){
    if(clips instanceof Map||(!Array.isArray(clips)&&clips&&typeof clips==='object')){
      const entries=clips instanceof Map?[...clips]:Object.entries(clips);
      for(const [state,clip] of entries)this.registerClip(state,clip);
      return;
    }
    for(const clip of clips||[]){
      const name=normalizeName(clipName(clip));
      const state=Object.keys(CHARACTER_ANIMATION_STATES).find(candidate=>
        (this.aliases[candidate]||[]).some(alias=>name===normalizeName(alias)||name.includes(normalizeName(alias)))
      );
      if(state&&!this._clips.has(state))this.registerClip(state,clip);
    }
  }

  _loadInteractions(interactions){
    const entries=interactions instanceof Map?[...interactions]:Object.entries(interactions||{});
    for(const [name,clipOrAction] of entries)this.registerInteraction(name,clipOrAction);
  }

  registerAction(state,action){
    const normalized=normalizeState(state);
    if(!normalized||!action)return false;
    this._actions.set(normalized,action);
    const clip=action.getClip?.();
    if(clip)this._clips.set(normalized,clip);
    return true;
  }

  registerClip(state,clip){
    const normalized=normalizeState(state);
    if(!normalized||!clip)return false;
    this._clips.set(normalized,clip);
    if(this.mixer?.clipAction)this._actions.set(normalized,this.mixer.clipAction(clip));
    return true;
  }

  registerInteraction(name,clipOrAction){
    const key=normalizeName(name);
    if(!key||!clipOrAction)return false;
    const action=typeof clipOrAction.play==='function'?clipOrAction:this.mixer?.clipAction?.(clipOrAction);
    this._interactions.set(key,{clip:action?.getClip?.()||clipOrAction,action:action||null});
    return true;
  }

  hasAnimation(state,name){
    const normalized=normalizeState(state);
    if(normalized===CHARACTER_ANIMATION_STATES.INTERACTION&&name)return this._interactions.has(normalizeName(name));
    return Boolean(normalized&&this._actions.get(normalized));
  }

  _entryFor(state,options={}){
    if(state===CHARACTER_ANIMATION_STATES.INTERACTION&&options.interaction){
      return this._interactions.get(normalizeName(options.interaction))||{};
    }
    return {action:this._actions.get(state)||null,clip:this._clips.get(state)||null};
  }

  _setTimeScale(action,state,speed=this.speed){
    if(!action)return 1;
    let scale=1;
    if(state===CHARACTER_ANIMATION_STATES.WALK||state===CHARACTER_ANIMATION_STATES.RUN){
      const reference=state===CHARACTER_ANIMATION_STATES.RUN?this.referenceSpeeds.run:this.referenceSpeeds.walk;
      scale=clamp(Math.abs(finite(speed))/Math.max(.01,finite(reference,1)),...this.timeScaleRange);
    }
    if(typeof action.setEffectiveTimeScale==='function')action.setEffectiveTimeScale(scale);
    else action.timeScale=scale;
    return scale;
  }

  transitionTo(nextState,options={}){
    if(this.disposed)return false;
    const state=normalizeState(nextState);
    if(!state){
      this._emit('onError',{error:new Error(`Unknown animation state: ${nextState}`),state:nextState});
      return false;
    }
    const interaction=state===CHARACTER_ANIMATION_STATES.INTERACTION?normalizeName(options.interaction):null;
    const sameState=this.state===state&&(!interaction||interaction===this.activeInteraction);
    if(sameState){
      this.speed=finite(options.speed,this.speed);
      this._setTimeScale(this.activeAction,state,this.speed);
      return true;
    }
    const entry=this._entryFor(state,options),nextAction=entry.action||null;
    const transition={from:this.state,to:state,interaction:interaction||null,options};
    if(this._emit('onBeforeTransition',transition)===false)return false;
    const fade=Math.max(0,finite(options.fadeDuration,this.fadeDuration));
    const oldAction=this.activeAction;
    if(nextAction){
      nextAction.enabled=true;
      nextAction.reset?.();
      nextAction.setEffectiveWeight?.(1);
      this._setTimeScale(nextAction,state,finite(options.speed,this.speed));
      if(oldAction&&oldAction!==nextAction){
        if(typeof nextAction.crossFadeFrom==='function')nextAction.crossFadeFrom(oldAction,fade,options.warp!==false);
        else{oldAction.fadeOut?.(fade);nextAction.fadeIn?.(fade)}
      }else if(!oldAction)nextAction.fadeIn?.(fade);
      nextAction.play?.();
      this._fallbackActive=false;
    }else if(this.fallback?.supports?.(state)!==false&&this.fallback?.transitionTo?.(state,{...options,interaction})){
      oldAction?.fadeOut?.(fade);
      this._fallbackActive=true;
      this._emit('onFallback',{...transition,reason:'missing-clip'});
    }else{
      // Keeping a valid previous action is safer than freezing or blocking SIDE.
      this._emit('onFallback',{...transition,reason:'missing-clip-no-adapter',retainedState:this.state});
      return false;
    }
    this.previousState=this.state;
    this.state=state;
    this.speed=finite(options.speed,this.speed);
    this.activeAction=nextAction;
    this.activeClip=entry.clip||nextAction?.getClip?.()||null;
    this.activeInteraction=interaction;
    this._emit('onTransition',{...transition,action:nextAction,clip:this.activeClip,fallback:this._fallbackActive});
    return true;
  }

  playIdle(options={}){return this.transitionTo(CHARACTER_ANIMATION_STATES.IDLE,options)}
  playWalk(speed=this.speed,options={}){return this.transitionTo(CHARACTER_ANIMATION_STATES.WALK,{...options,speed})}
  playRun(speed=this.speed,options={}){return this.transitionTo(CHARACTER_ANIMATION_STATES.RUN,{...options,speed})}
  playTalk(options={}){return this.transitionTo(CHARACTER_ANIMATION_STATES.TALK,options)}
  playInteraction(interaction,options={}){return this.transitionTo(CHARACTER_ANIMATION_STATES.INTERACTION,{...options,interaction})}
  playAirborne(options={}){return this.transitionTo(CHARACTER_ANIMATION_STATES.AIRBORNE,options)}

  _stateFromContext(context){
    if(context.state)return normalizeState(context.state);
    if(context.interaction)return CHARACTER_ANIMATION_STATES.INTERACTION;
    if(context.talking)return CHARACTER_ANIMATION_STATES.TALK;
    if(context.grounded===false)return CHARACTER_ANIMATION_STATES.AIRBORNE;
    const speed=Math.abs(finite(context.speed));
    if(speed>=this.runThreshold)return CHARACTER_ANIMATION_STATES.RUN;
    if(speed>=this.walkThreshold)return CHARACTER_ANIMATION_STATES.WALK;
    return CHARACTER_ANIMATION_STATES.IDLE;
  }

  update(dt,context={}){
    if(this.disposed)return;
    dt=clamp(finite(dt),0,.1);
    this.speed=Math.abs(finite(context.speed,this.speed));
    const state=this._stateFromContext(context);
    if(state)this.transitionTo(state,{speed:this.speed,interaction:context.interaction,fadeDuration:context.fadeDuration});
    this._setTimeScale(this.activeAction,this.state,this.speed);
    if(dt)this.mixer?.update?.(dt);
    if(this._fallbackActive&&dt)this.fallback?.update?.(dt,{...context,state:this.state,speed:this.speed});
    this._emit('onUpdate',{dt,state:this.state,speed:this.speed,fallback:this._fallbackActive});
  }

  getSnapshot(){
    return Object.freeze({
      state:this.state,
      previousState:this.previousState,
      interaction:this.activeInteraction,
      speed:this.speed,
      fallback:this._fallbackActive,
      clip:clipName(this.activeClip)||null,
      metadata:this.metadata
    });
  }

  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    const root=this.mixer?.getRoot?.();
    for(const action of new Set([...this._actions.values(),...[...this._interactions.values()].map(entry=>entry.action).filter(Boolean)])){
      action.stop?.();
      const clip=action.getClip?.();
      if(clip)this.mixer?.uncacheAction?.(clip,root);
    }
    this.mixer?.stopAllAction?.();
    if(root)this.mixer?.uncacheRoot?.(root);
    this.fallback?.dispose?.();
    this._actions.clear();this._clips.clear();this._interactions.clear();
    this.activeAction=null;this.activeClip=null;this.fallback=null;this.mixer=null;
    this._emit('onDispose',{state:this.state});
  }
}

export default CharacterAnimationController;
