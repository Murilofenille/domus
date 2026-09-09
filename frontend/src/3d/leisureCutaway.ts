import * as THREE from 'three';

/** Agrupa apenas a apresentação; visible dos filhos e estados das luzes são preservados. */
export function createWallCutaway(scene:THREE.Scene,meshes:THREE.Mesh[]) {
  const definitions=[{id:29,axis:'x' as const,sign:-1},{id:1,axis:'x' as const,sign:1},
    {id:0,axis:'z' as const,sign:-1},{id:26,axis:'z' as const,sign:1}];
  const walls=definitions.flatMap(d=>{
    const mesh=meshes.find(m=>m.userData.id===d.id);if(!mesh)return [];
    const bounds=new THREE.Box3().setFromObject(mesh);
    return [{...d,mesh,bounds,plane:(bounds.min[d.axis]+bounds.max[d.axis])/2,hidden:false}];
  });
  const architectural=new Set([0,1,26,29,24,39,40,41,42,43,44,45,46,47,48,50,54,22,23]);
  const entries:{wrapper:THREE.Group;members:number[]}[]=[];
  for(const object of [...scene.children]) {
    const id=object.userData.id;
    const isGate=object.name.startsWith('Portão ');
    const isLamp=object.name.includes('arandela')||object.name.includes('Arandela');
    const isBeam=object instanceof THREE.Mesh&&object.geometry instanceof THREE.PlaneGeometry&&Math.abs(object.position.z)>4.7;
    if(!architectural.has(id)&&!isGate&&!isLamp&&!isBeam)continue;
    const bounds=new THREE.Box3().setFromObject(object),center=bounds.getCenter(new THREE.Vector3());
    const members=walls.flatMap((w,i)=>{
      if(w.id===id)return [i];
      const thickness=bounds.max[w.axis]-bounds.min[w.axis];
      return Math.abs(center[w.axis]-w.plane)<.42&&thickness<.85?[i]:[];
    });
    if(!members.length)continue;
    const wrapper=new THREE.Group();wrapper.name=`Visibilidade automática: ${object.name||'facho'}`;
    scene.add(wrapper);wrapper.attach(object);entries.push({wrapper,members});
  }
  return {
    update(camera:THREE.Camera) {
      let changed=false;
      for(const w of walls) {
        const distance=(camera.position[w.axis]-w.plane)*w.sign;
        let obstructs=false;
        if(distance>(w.hidden?-.12:.18)) {
          const other=w.axis==='x'?'z':'x';
          const top=w.mesh.scale.y*w.bounds.max.y;
          // Raios para pontos logo dentro do muro: detectam o primeiro plano bloqueado.
          for(const fraction of [.2,.5,.8]) {
            const sampleAxis=w.plane-w.sign*1.8;
            const denom=sampleAxis-camera.position[w.axis];
            if(Math.abs(denom)<1e-6)continue;
            const t=(w.plane-camera.position[w.axis])/denom;
            const sampleOther=THREE.MathUtils.lerp(w.bounds.min[other],w.bounds.max[other],fraction);
            const crossOther=THREE.MathUtils.lerp(camera.position[other],sampleOther,t);
            const crossY=THREE.MathUtils.lerp(camera.position.y,.45,t);
            if(t>0&&t<1&&crossOther>=w.bounds.min[other]&&crossOther<=w.bounds.max[other]&&crossY<top+(w.hidden?.22:-.06))obstructs=true;
          }
        }
        if(w.hidden!==obstructs){w.hidden=obstructs;changed=true;}
      }
      for(const e of entries)e.wrapper.visible=!e.members.some(i=>walls[i].hidden);
      return changed;
    }
  };
}
