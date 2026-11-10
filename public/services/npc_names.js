import * as THREE from 'three';
const materials=new Map();

export function setNpcName(group,name,height=1.75) {
  const old=group.getObjectByName('NpcNameLabel');if(old)old.removeFromParent();
  let material=materials.get(name);
  if(!material) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='rgba(10,22,30,.84)';ctx.beginPath();ctx.roundRect(4,4,504,120,24);ctx.fill();
    ctx.strokeStyle='rgba(210,227,235,.6)';ctx.lineWidth=3;ctx.stroke();
    ctx.font='600 56px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4f8fb';
    ctx.fillText(name,256,65,470);
    material=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,toneMapped:false});
    materials.set(name,material);
  }
  const label=new THREE.Sprite(material);label.name='NpcNameLabel';label.position.set(0,height+.17,0);
  label.scale.set(.78,.195,1);label.userData.sharedCharacterResource=true;
  group.add(label);group.userData.displayName=name;return label;
}
