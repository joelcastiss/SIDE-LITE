import {resolveCircleMotion} from './npc_navigation.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const PLAYER_STATE=Object.freeze({ON_FOOT:'PLAYER_ON_FOOT',ENTERING:'ENTERING_VEHICLE',DRIVING:'DRIVING',EXITING:'EXITING_VEHICLE'});

// Input is camera-relative; integrate in short steps to preserve thin collisions.
export function stepPlayerMotion(player,input,dt,blocked=()=>false,options={}) {
  dt=clamp(dt,0,.05);
  const length=Math.hypot(input.forward||0,input.side||0),sprint=Boolean(input.sprint&&length);
  const speed=sprint?5.2:2.65,rate=player.grounded?(length?(sprint?8:12):15):(length?2.4:1.2);
  const f=length?(input.forward||0)/length:0,s=length?(input.side||0)/length:0;
  const sin=Math.sin(input.yaw||0),cos=Math.cos(input.yaw||0);
  const dx=(s*cos-f*sin)*speed,dz=(-f*cos-s*sin)*speed;
  const steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps;
  let travelled=0;
  for(let i=0;i<steps;i++) {
    const blend=1-Math.exp(-rate*h);
    player.vx+=(dx-player.vx)*blend;player.vz+=(dz-player.vz)*blend;
    if(!length&&Math.hypot(player.vx,player.vz)<.015)player.vx=player.vz=0;
    const x=player.x,z=player.z,nx=x+player.vx*h,nz=z+player.vz*h;
    if(!blocked(nx,z))player.x=nx;else player.vx=0;
    if(!blocked(player.x,nz))player.z=nz;else player.vz=0;
    if(options.neighbors?.length){
      const next=resolveCircleMotion({x,z},player,{radius:options.radius||player.radius||.36,
        neighbors:options.neighbors,blocked,maxCorrection:1.2*h});
      player.x=next.x;player.z=next.z;
      // Only retain the displacement actually allowed by contact. This prevents
      // accumulated inward velocity from vibrating against a stationary body.
      if(h&&Math.hypot(nx-player.x,nz-player.z)>1e-7){player.vx=(player.x-x)/h;player.vz=(player.z-z)/h;}
    }
    travelled+=Math.hypot(player.x-x,player.z-z);
  }
  player.speed=dt?travelled/dt:0;
  player.locomotion=!player.grounded?'AIRBORNE':player.speed<.08?'IDLE':player.speed>3.2?'RUN':'WALK';
  return {travelled,sprinting:sprint};
}

// Exact segment vs expanded 2D building bounds. Apply AFTER camera smoothing,
// so an old camera position on the other side of a wall cannot leak through.
export function constrainCamera(focus,desired,obstacles,padding=.22) {
  let nearest=1;
  const dx=desired.x-focus.x,dz=desired.z-focus.z;
  for(const box of obstacles) {
    let enter=0,exit=1;
    for(const [origin,delta,min,max] of [[focus.x,dx,box.minX-padding,box.maxX+padding],[focus.z,dz,box.minZ-padding,box.maxZ+padding]]) {
      if(Math.abs(delta)<1e-9){if(origin<min||origin>max){enter=2;break;}continue;}
      const a=(min-origin)/delta,b=(max-origin)/delta;
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    }
    if(enter<=exit&&exit>=0&&enter<=1)nearest=Math.min(nearest,Math.max(0,enter-.025));
  }
  return {x:focus.x+dx*nearest,y:focus.y+(desired.y-focus.y)*nearest,z:focus.z+dz*nearest};
}

export function advanceVehicleTransition(transition,dt) {
  transition.elapsed=Math.min(transition.duration,transition.elapsed+clamp(dt,0,.05));
  const t=transition.elapsed/transition.duration,s=t*t*(3-2*t);
  return {x:transition.from.x+(transition.to.x-transition.from.x)*s,z:transition.from.z+(transition.to.z-transition.from.z)*s,done:t>=1};
}
