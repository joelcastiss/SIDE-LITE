// Animation adapter for licensed NPC GLBs. It never changes the player rig.
export const NPC_CLIP_STATES=Object.freeze(['idle','idle2','walk','run','talk','carry','pickup','inspect','pay','sit']);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const normal=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const ALIASES=Object.freeze({
  idle:['idle','standing idle','stand idle'],idle2:['idle 2','idle 02','idle variant 2','look around'],
  walk:['walk','walking'],run:['run','running','jog'],talk:['talk','talking','speaking'],
  carry:['carry','carrying'],pickup:['pickup','pick up','picking up'],
  inspect:['inspect','inspection','look at'],pay:['pay','payment','checkout'],sit:['sit','sitting']
});

export function classifyNpcClip(name){
  // Some CC0 packs prefix every clip with the armature and character name.
  // Keep the final action token so a genuine "Man_Walk" still maps to walk.
  const value=normal(String(name||'').split('|').pop()).replace(/^(female|male|woman|man) /,'');
  // Specific phrases must win over the generic "idle" token.
  for(const state of ['idle2',...NPC_CLIP_STATES.filter(item=>item!=='idle2')])if(ALIASES[state].some(alias=>value===alias||value.startsWith(`${alias} `)))return state;
  return null;
}

export function indexNpcClips(clips=[]){
  const found={};
  for(const clip of clips){const state=classifyNpcClip(clip?.name);if(state&&!found[state])found[state]=clip}
  return found;
}

// Root translation is informative only when the authored clip actually moves.
// In-place clips need an explicitly measured or tuned meters-per-cycle value.
export function rootMotionSpeed(clip){
  const duration=Number(clip?.duration);
  if(!(duration>0))return null;
  for(const track of clip.tracks||[]){
    if(!/\.(position)$/.test(track.name)||!/root|hips|pelvis/i.test(track.name))continue;
    const values=track.values;
    if(!values||values.length<6)continue;
    const dx=values[values.length-3]-values[0],dz=values[values.length-1]-values[2];
    const speed=Math.hypot(dx,dz)/duration;
    if(speed>.05&&Number.isFinite(speed))return speed;
  }
  return null;
}

export function createNpcClipController({mixer,clips=[],clipSpeeds={},fadeSeconds=.2,idleVariant=0}={}){
  if(!mixer?.clipAction)throw new TypeError('NPC mixer requerido');
  const catalog=indexNpcClips(clips),actions={};
  for(const [state,clip] of Object.entries(catalog))actions[state]=mixer.clipAction(clip);
  const available=Object.keys(actions),missing=NPC_CLIP_STATES.filter(state=>!actions[state]);
  let state=null,active=null,elapsed=0,disposed=false;
  const idle=()=>idleVariant%2===1&&actions.idle2?'idle2':actions.idle2&&elapsed>9?'idle2':'idle';
  function choose(requested,speed){
    if(requested&&actions[requested])return requested;
    if(speed>2.7&&actions.run)return 'run';
    if(speed>.08&&actions.walk)return 'walk';
    return idle();
  }
  function transition(next){
    if(next===state)return;
    const action=actions[next];if(!action)return;
    action.enabled=true;action.reset?.();action.setEffectiveWeight?.(1);
    if(active&&active!==action){
      if(action.crossFadeFrom)action.crossFadeFrom(active,fadeSeconds,false);
      else{active.fadeOut?.(fadeSeconds);action.fadeIn?.(fadeSeconds)}
    }else action.fadeIn?.(fadeSeconds);
    action.play?.();active=action;state=next;
  }
  function update(dt,{distance=0,requested=null,visible=true}={}){
    if(disposed)return;
    dt=clamp(Number(dt)||0,0,.25);if(!dt)return;
    // Distance must be actual post-collision travel, never the intended speed.
    const speed=clamp(Math.max(0,Number(distance)||0)/dt,0,8);
    elapsed+=dt;
    const next=choose(requested,speed);
    transition(next);
    if(active&&(state==='walk'||state==='run')){
      const clip=catalog[state],reference=Number(clipSpeeds[state])||rootMotionSpeed(clip);
      // If clip speed is unknown, do not claim foot sync; keep native timing.
      const ratio=reference?clamp(speed/reference,.6,1.6):1;
      active.setEffectiveTimeScale?.(ratio);
    }else active?.setEffectiveTimeScale?.(1);
    if(visible)mixer.update(dt);
  }
  function dispose(){
    if(disposed)return;disposed=true;
    for(const action of Object.values(actions))action.stop?.();
    mixer.stopAllAction?.();
  }
  return {available,missing,retargeted:[],get state(){return state},get clip(){return catalog[state]?.name||null},update,dispose};
}
