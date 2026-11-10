import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const STANCE=.60;
const IDENTITY=new THREE.Quaternion(),UP=new THREE.Vector3(0,1,0);
let shadowGeometry,shadowMaterial;
function contactShadow() {
  if(!shadowMaterial) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,32);
    gradient.addColorStop(0,'rgba(0,0,0,.30)');gradient.addColorStop(.5,'rgba(0,0,0,.13)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    shadowMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,toneMapped:false});
    shadowGeometry=new THREE.PlaneGeometry(.65,.75);
  }
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.name='ContactShadow';
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.006;shadow.userData.sharedCharacterResource=true;return shadow;
}

export async function loadTemplate(GLTFLoader, url) {
  const gltf=await new GLTFLoader().loadAsync(url);
  let profile;
  gltf.scene.traverse(node=>{
    if(node.userData.sideRig)profile=node.userData.sideRig;
    if(!node.isMesh)return;
    node.userData.sharedCharacterResource=true;
    // A posed scan's resting bounds do not include every animated foot position.
    node.frustumCulled=false;
    node.castShadow=true;node.receiveShadow=true;
    // Each file owns its texture set. Identical source texture names are not identities.
    for(const material of (Array.isArray(node.material)?node.material:[node.material])) {
      for(const key of ['map','normalMap','metalnessMap','roughnessMap'])if(material[key])material[key].anisotropy=4;
    }
  });
  if(!profile)throw Error('El modelo no contiene el esqueleto SIDE.');
  return {scene:gltf.scene,profile,height:profile.height,animations:0};
}

export function createNpc(template, kind) {
  const group=new THREE.Group(), avatar=clone(template.scene), bones={};group.add(avatar,contactShadow());
  avatar.traverse(node=>{if(node.isBone)bones[node.name]=node});
  group.name=kind;
  const rest={};for(const [name,bone] of Object.entries(bones))rest[name]=bone.position.clone();
  // A stable offset keeps a crowd from breathing and looking around in unison.
  const seed=[...kind].reduce((v,c)=>(v*31+c.charCodeAt(0))%997,0),variation=(seed*137%997)/997;
  const feet={};
  for(const side of ['L','R'])feet[side]={anchor:new THREE.Vector3(),release:new THREE.Vector3(),target:new THREE.Vector3(),planted:false,phase:0,yaw:0};
  group.userData={modelKind:kind,modelAvatar:avatar,motion:{bones,rest,profile:template.profile,phase:0,blend:0,pivotPhase:0,pivotBlend:0,lastYaw:null,time:variation*TAU,lastPosition:null,distance:0,speed:0,pace:0,turnRate:0,feet,
    scratch:{target:new THREE.Vector3(),direction:new THREE.Vector3(),bend:new THREE.Vector3(),knee:new THREE.Vector3(),lower:new THREE.Vector3(),axis:new THREE.Vector3(),inverse:new THREE.Quaternion(),upper:new THREE.Quaternion(),shin:new THREE.Quaternion(),sole:new THREE.Quaternion()}}};
  animateNpc(group,1/60,false);
  return group;
}

export function resetMotion(group) {
  const m=group.userData.motion;
  if(m){m.lastPosition=null;m.lastYaw=null;m.blend=0;m.pivotBlend=0;m.pivotPhase=0;m.phase=0;m.speed=0;m.pace=0;m.turnRate=0;m.distance=0;for(const foot of Object.values(m.feet)){foot.planted=false;foot.phase=0}}
}

// Solve the complete leg in 3D. This compensates lateral weight transfer and
// steering, rather than forcing every knee/ankle into one sagittal plane.
function legIK(m,side,target,blend,soleYaw=0,solePitch=0) {
  const b=m.bones,r=m.rest,s=m.scratch,thigh=b['Thigh'+side],shin=b['Shin'+side],foot=b['Foot'+side];
  const upper=r['Shin'+side],lower=r['Foot'+side],l1=upper.length(),l2=lower.length();
  s.inverse.copy(b.Hips.quaternion).invert();
  s.target.copy(target).sub(b.Hips.position).applyQuaternion(s.inverse).sub(thigh.position);
  const length=clamp(s.target.length(),.001,l1+l2-.0001);
  s.direction.copy(s.target).normalize();
  s.bend.set(0,0,1).addScaledVector(s.direction,-s.direction.z).normalize();
  const along=(l1*l1+length*length-l2*l2)/(2*length);
  s.knee.copy(s.direction).multiplyScalar(along).addScaledVector(s.bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  s.upper.setFromUnitVectors(s.axis.copy(upper).normalize(),s.lower.copy(s.knee).normalize());
  s.inverse.copy(s.upper).invert();
  s.lower.copy(s.direction).multiplyScalar(length).sub(s.knee).applyQuaternion(s.inverse).normalize();
  s.shin.setFromUnitVectors(s.axis.copy(lower).normalize(),s.lower);
  thigh.quaternion.copy(IDENTITY).slerp(s.upper,blend);
  shin.quaternion.copy(IDENTITY).slerp(s.shin,blend);
  // Preserve the planted sole's heading through a turn and keep it flat on the
  // floor. Only the free foot dorsiflexes while it clears the ground.
  s.sole.copy(b.Hips.quaternion).multiply(thigh.quaternion).multiply(shin.quaternion).invert();
  s.inverse.setFromAxisAngle(UP,soleYaw*blend);s.sole.multiply(s.inverse);
  s.inverse.setFromAxisAngle(s.axis.set(1,0,0),solePitch*blend);
  foot.quaternion.copy(s.sole).multiply(s.inverse);
}

export function animateNpc(group,dt,moving=true) {
  const m=group.userData.motion;if(!m)return;
  dt=clamp(dt,0,.1);if(!dt)return;
  const p=group.position;
  const distance=m.lastPosition?Math.hypot(p.x-m.lastPosition.x,p.z-m.lastPosition.z):0;
  // Repositioning/pooling is not walking. It must not advance the gait.
  const teleported=distance>=.5;
  const travelled=!teleported&&moving?distance:0;
  if(teleported)for(const foot of Object.values(m.feet)){foot.planted=false;foot.release.set(0,0,0)}
  m.lastPosition={x:p.x,z:p.z};m.distance+=travelled;m.time+=dt;
  m.speed=travelled/dt;
  const signedTurn=m.lastYaw===null?0:wrap(group.rotation.y-m.lastYaw),turn=Math.abs(signedTurn);m.lastYaw=group.rotation.y;
  m.turnRate+=(clamp(signedTurn/dt,-3,3)-m.turnRate)*(1-Math.exp(-dt*8));
  m.pace+=(m.speed-m.pace)*(1-Math.exp(-dt*6));
  m.pivotPhase=(m.pivotPhase+turn/1.6)%1;
  const pivotTarget=clamp(turn/dt/1.5,0,1)*(m.speed<.1?1:0);
  m.pivotBlend+=(pivotTarget-m.pivotBlend)*(1-Math.exp(-dt*12));
  const target=m.speed>.025?1:0;
  m.blend+=(target-m.blend)*(1-Math.exp(-dt*(target?10:9)));
  const run=clamp((m.pace-1.8)/2.7,0,1);
  const stance=STANCE-run*.15;
  const stride=(.93+run*1.05)*m.profile.height/1.75;
  m.phase=(m.phase+travelled/stride)%1;
  const b=m.bones,r=m.rest,h=m.profile.height,w=m.blend,pivot=m.pivotBlend*(1-w),weight=Math.max(w,pivot);
  const cycle=w>.15?m.phase:m.pivotPhase, gait=Math.sin(m.phase*TAU),pace=clamp(m.pace/.95,.4,1.3);
  for(const [name,bone] of Object.entries(b)){bone.position.copy(r[name]);bone.rotation.set(0,0,0)}
  b.Hips.position.y-=h*(.030+(.004+run*.013)*Math.cos(m.phase*TAU*2))*w+.016*pivot;
  b.Hips.position.x-=h*.009*gait*w;
  b.Hips.rotation.y=.022*gait*w;
  b.Hips.rotation.z=.012*gait*w;
  group.updateMatrixWorld(true);
  for(const [side,offset] of [['L',0],['R',.5]]) {
    const phase=(cycle+offset)%1,foot=m.feet[side],sign=side==='L'?-1:1,t=(phase-stance)/(1-stance);
    const travelWeight=weight?w/weight:0,x=m.profile.legX*h*sign,ankle=m.profile.ankle*h;
    const footTarget=foot.target.set(x,ankle,0);
    let soleYaw=0,solePitch=0;
    if(phase<stance){
      footTarget.z=stride*(stance*.5-phase)*travelWeight;
      if(!foot.planted||phase<foot.phase){
        foot.anchor.copy(footTarget);group.localToWorld(foot.anchor);foot.yaw=group.rotation.y;foot.planted=true;
      }
      // World-space contact survives both translation and a change of heading.
      group.worldToLocal(footTarget.copy(foot.anchor));
      footTarget.y=ankle;
      soleYaw=clamp(wrap(foot.yaw-group.rotation.y),-.55,.55);
    }else{
      if(foot.planted){
        group.worldToLocal(foot.release.copy(foot.anchor));
        foot.release.x-=x;foot.release.y-=ankle;foot.release.z+=stride*stance*.5*travelWeight;
        foot.planted=false;
      }
      footTarget.z=stride*stance*(smooth(t)-.5)*travelWeight;
      footTarget.addScaledVector(foot.release,1-smooth(t));
      footTarget.y=ankle+(h*(.047+run*.085)*travelWeight+h*.032*(1-travelWeight))*Math.sin(Math.PI*t)**2;
      solePitch=-.09*Math.sin(Math.PI*t);
    }
    foot.phase=phase;
    if(weight<.001){foot.planted=false;foot.release.set(0,0,0)}
    legIK(m,side,footTarget,weight,soleYaw,solePitch);
    if(m.profile.freeArms.includes(sign)) {
      const swing=Math.cos((m.phase+offset)*TAU),arm=b['UpperArm'+side],forearm=b['Forearm'+side];
      arm.rotation.x=swing*(.33+run*.3)*pace*w;
      arm.rotation.z=sign*(.022*w+.006*Math.sin(m.time*1.35));
      forearm.rotation.x=(-.09-run*.85-.13*Math.max(0,-swing))*w;
      b['Hand'+side].rotation.x=.035*Math.sin((m.phase+offset)*TAU-.4)*w;
    }
  }
  const breath=Math.sin(m.time*1.8);
  b.Spine.rotation.y=-gait*.030*w;
  b.Spine.rotation.z=-b.Hips.rotation.z*.65;
  b.Chest.rotation.y=-gait*.048*w+m.turnRate*.018;
  b.Chest.rotation.x=.008*breath+(.026+run*.1)*w;
  b.Chest.position.y+=h*.0013*breath;
  b.Head.rotation.y=.040*Math.sin(m.time*.63)*(1-w)+clamp(m.turnRate*.065,-.16,.16);
  b.Head.rotation.x=-.007*breath-.014*w;
  b.Head.rotation.z=-b.Hips.rotation.z*.35;
  group.updateMatrixWorld(true);
}
