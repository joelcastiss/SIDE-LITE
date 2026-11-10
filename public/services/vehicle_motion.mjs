const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Metres, seconds, radians. Positive speed follows the vehicle's local -Z.
export function stepVehicle(car,input,dt,blocked=()=>false) {
  dt=clamp(dt,0,.05);
  const steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps;
  let hit=false;
  for(let i=0;i<steps;i++) {
    const throttle=clamp(input.throttle||0,-1,1),brake=Boolean(input.brake);
    const targetSteer=clamp(input.steer||0,-1,1)*.52/(1+Math.abs(car.speed)*.045);
    car.steer+=(targetSteer-car.steer)*(1-Math.exp(-h*9));
    const opposing=throttle*car.speed<-.2;
    const force=throttle*(opposing?18:8.5);
    car.speed+=force*h;
    const drag=(brake?24:throttle? .45:2.4)+car.speed*car.speed*.012;
    car.speed=Math.sign(car.speed)*Math.max(0,Math.abs(car.speed)-drag*h);
    car.speed=clamp(car.speed,-6,19);
    const nextYaw=car.yaw+car.speed/2.65*Math.tan(car.steer)*h;
    const x=car.x-Math.sin(nextYaw)*car.speed*h,z=car.z-Math.cos(nextYaw)*car.speed*h;
    if(blocked(x,z,nextYaw)){car.speed=0;hit=true;}else{car.x=x;car.z=z;car.yaw=nextYaw;}
    car.wheelAngle=(car.wheelAngle||0)+car.speed*h/.36;
  }
  return {hit};
}

// Three overlapping circles approximate the chassis, including its bumpers.
export function vehicleHits(x,z,yaw,obstacles,bounds) {
  for(const along of [-1.35,0,1.35]) {
    const px=x+Math.sin(yaw)*along,pz=z+Math.cos(yaw)*along,r=.94;
    if(bounds&&(px-r<bounds.minX||px+r>bounds.maxX||pz-r<bounds.minZ||pz+r>bounds.maxZ))return true;
    if(obstacles.some(c=>Math.hypot(px-clamp(px,c.minX,c.maxX),pz-clamp(pz,c.minZ,c.maxZ))<r))return true;
  }
  return false;
}

export function vehicleCircles(x,z,yaw) {
  return [-1.35,0,1.35].map(along=>({x:x+Math.sin(yaw)*along,z:z+Math.cos(yaw)*along,radius:.94}));
}

export function vehicleHitsPeople(x,z,yaw,people) {
  return vehicleCircles(x,z,yaw).some(circle=>people.some(person=>
    Math.hypot(circle.x-person.x,circle.z-person.z)<circle.radius+(Number(person.radius)||.29)));
}

// Use the same rotated chassis for both participants, including bumpers.
export function vehiclesOverlap(a,b,margin=0) {
  for(const alongA of [-1.35,0,1.35])for(const alongB of [-1.35,0,1.35]) {
    const dx=a.x+Math.sin(a.yaw)*alongA-b.x-Math.sin(b.yaw)*alongB;
    const dz=a.z+Math.cos(a.yaw)*alongA-b.z-Math.cos(b.yaw)*alongB;
    if(Math.hypot(dx,dz)<1.88+margin)return true;
  }
  return false;
}
