import {NPC_RADIUS,planPath,segmentClear,expanded,advance} from './npc_navigation.mjs';

const point=value=>Array.isArray(value)?{x:value[0],z:value[1]}:{x:value?.x,z:value?.z};
const finite=p=>Number.isFinite(p.x)&&Number.isFinite(p.z);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inBounds=(p,b)=>!b||(p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ);
const free=(p,boxes)=>!boxes.some(b=>p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);

// A patrol owns only its route/timers. World coordinates and animation remain
// with the caller; recovery changes a destination, never an actor position.
export function createNpcPatrol({points=[],navigator=null,obstacles=[],bounds=null,
  random=Math.random,maxSpeed=1.1,stuckSeconds=2.2,minimumProgress=.12}={}){
  let solids=obstacles,route=[],index=0,pause=0,elapsed=0,origin=null,replans=0;
  let avoidingUntil=0,time=0;
  const destinations=points.map(point).filter(finite);
  const randomUnit=()=>Math.max(0,Math.min(.999999,Number(random())||0));
  const legal=p=>finite(p)&&inBounds(p,bounds)&&free(p,expanded(solids,NPC_RADIUS+.05));
  function spawn(desired=destinations[0]){
    desired=point(desired);
    const sampled=navigator?.sampleSpawn?.(desired);
    if(sampled&&legal(sampled))return {...sampled};
    // Fallback nodes are still checked against every actual solid collider.
    const candidates=destinations.filter(legal).sort((a,b)=>distance(a,desired)-distance(b,desired));
    if(candidates.length)return {...candidates[0]};
    return legal(desired)?{...desired}:null;
  }
  function validRoute(from,planned,goal,blocks){
    if(!Array.isArray(planned)||!planned.length)return false;
    let previous=from;
    for(const value of planned){
      const next=point(value);
      if(!finite(next)||!inBounds(next,bounds)||!segmentClear(previous,next,expanded(blocks)))return false;
      previous=next;
    }
    return distance(previous,goal)<.25;
  }
  function plan(from,goal,blocks=solids){
    if(!legal(goal))return [];
    let planned;
    try{planned=blocks===solids?navigator?.plan?.(from,goal):null}catch{/* safe fallback */}
    if(!validRoute(from,planned,goal,blocks))planned=planPath(from,goal,blocks);
    return validRoute(from,planned,goal,blocks)?planned.map(v=>{const p=point(v);return [p.x,p.z]}):[];
  }
  function choose(from,neighbors=[],recover=false){
    replans++;
    const people=neighbors.filter(finite).filter(p=>distance(from,p)<3).map(p=>{
      const radius=Math.max(.3,Number(p.radius)||NPC_RADIUS);
      return {minX:p.x-radius,maxX:p.x+radius,minZ:p.z-radius,maxZ:p.z+radius};
    });
    const blocks=recover&&people.length?[...solids,...people]:solids;
    // Cycle through all destinations in bounded time. A null or partial path
    // must not leave an NPC in an idle state without an exit.
    for(let attempt=0;attempt<destinations.length;attempt++){
      index=(index+1)%destinations.length;
      const goal=destinations[index];
      if(distance(from,goal)<.7)continue;
      const next=plan(from,goal,blocks);
      if(next.length){route=next;avoidingUntil=recover?time+2:0;return true}
    }
    // A player or parked vehicle may occupy the next waypoint. Try a short
    // lateral waypoint and resume the ordinary route after passing it.
    if(recover){
      const heading=Number(from.yaw)||0;
      for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4]){
        const goal={x:from.x+Math.sin(heading+angle)*1.6,z:from.z+Math.cos(heading+angle)*1.6};
        if(neighbors.some(p=>distance(p,goal)<Math.max(.65,Number(p.radius)||0)))continue;
        const next=plan(from,goal,blocks);
        if(next.length){route=next;avoidingUntil=time+2;return true}
      }
    }
    route=[];return false;
  }
  function update(state,dt,{neighbors=[],obstacles:nextObstacles}={}){
    dt=Math.max(0,Math.min(.05,Number(dt)||0));time+=dt;
    if(nextObstacles)solids=nextObstacles;
    if(!origin)origin={x:state.x,z:state.z};
    if(pause>0){pause=Math.max(0,pause-dt);state.speed=0;return snapshot(0,false)}
    if(!route.length)choose(state,neighbors);
    elapsed+=dt;
    if(elapsed>=stuckSeconds){
      if(distance(state,origin)<minimumProgress){choose(state,neighbors,true);state.speed=0;pause=0}
      origin={x:state.x,z:state.z};elapsed=0;
    }
    const target=route[0];
    if(!target){state.speed=0;return snapshot(0,false)}
    const from={x:state.x,z:state.z},goal={x:target[0],z:target[1]};
    // Optional steering feeds the same collision guard. A temporary detour
    // uses the pure guard so the shared navigator keeps static obstacles.
    let moved;
    if(navigator?.advance&&time>=avoidingUntil)moved=navigator.advance(state,goal,dt,neighbors,maxSpeed,route.length===1);
    else moved=advance(state,goal,dt,solids,neighbors,maxSpeed,route.length===1);
    const actual=distance(state,from);
    if(moved.arrived||distance(state,goal)<.1){
      route.shift();
      if(!route.length){pause=.2+randomUnit()*1.3;elapsed=0;origin={x:state.x,z:state.z}}
    }
    return snapshot(actual,Boolean(moved.arrived));
  }
  function snapshot(moved,arrived){return {distance:moved,arrived,pause,route,index,replans}}
  return {spawn,update,setObstacles(next){solids=Array.isArray(next)?next:[]},get snapshot(){return snapshot(0,false)}};
}
