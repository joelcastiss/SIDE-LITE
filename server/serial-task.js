// Avoid accumulating overlapping sweeps when a database operation is slow.
export function serialTask(task,onError=()=>{}) {
  let active=false;
  return async function run() {
    if(active) return false;
    active=true;
    try { await task(); return true; }
    catch(error) { onError(error); return false; }
    finally { active=false; }
  };
}
