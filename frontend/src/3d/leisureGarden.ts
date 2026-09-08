import * as THREE from 'three';

/** Substitui apenas vaso/vegetação; mantém a posição do modelo fornecido. */
export function refineGarden(scene: THREE.Scene, meshes: THREE.Mesh[]) {
  const original = meshes.find(m => m.userData.id === 53);
  if (!original) return;
  const bounds = new THREE.Box3().setFromObject(original);
  const center = bounds.getCenter(new THREE.Vector3());
  const height = bounds.max.y - bounds.min.y;
  const radius = (bounds.max.x - bounds.min.x) * 0.5;
  meshes.filter(m => [12, 53].includes(m.userData.id)).forEach(m => { m.visible = false; });
  const group = new THREE.Group();
  group.name = 'Vaso facetado e palmeira — referência do vídeo';
  group.position.set(center.x, bounds.min.y, center.z);
  scene.add(group);
  const stone = new THREE.MeshStandardMaterial({ color: '#cbc9be', roughness: 0.88 });
  const dark = new THREE.MeshStandardMaterial({ color: '#35362f', roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: '#97917a', roughness: 0.95 });
  const foliage = [0x527735, 0x3d662b, 0x6a8d40].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, side: THREE.DoubleSide }));
  function add(geo: THREE.BufferGeometry, mat: THREE.Material, name: string) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  // Perfil inclui a borda e a parede interna: o vaso fica aberto, com terra visível.
  add(new THREE.LatheGeometry([
    new THREE.Vector2(radius*.63,0), new THREE.Vector2(radius*.69,height*.12),
    new THREE.Vector2(radius,height*.94), new THREE.Vector2(radius,height),
    new THREE.Vector2(radius*.91,height), new THREE.Vector2(radius*.88,height*.82)
  ],48),stone,'Vaso cerâmico aberto');
  const soil = add(new THREE.CylinderGeometry(radius*.89,radius*.89,.035,40),dark,'Terra');
  soil.position.y=height*.85;
  // Faixas de triângulos em relevo, inspiradas no vaso da fotografia.
  const positions:number[]=[];
  for(let row=0;row<5;row++) for(let i=0;i<24;i++) {
    const y0=height*(.12+row*.15), y1=y0+height*.14;
    const a=(i+(row%2)*.5)*Math.PI/12, b=a+Math.PI/12;
    const r0=radius*(.69+.31*y0/height),r1=radius*(.69+.31*y1/height);
    const vertices=[new THREE.Vector3(Math.cos(a)*r0,y0,Math.sin(a)*r0),
      new THREE.Vector3(Math.cos(b)*r0,y0,Math.sin(b)*r0),
      new THREE.Vector3(Math.cos((a+b)/2)*r1,y1,Math.sin((a+b)/2)*r1)];
    const tip=vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3);
    tip.x*=1.08;tip.z*=1.08;
    for(let k=0;k<3;k++) for(const v of [vertices[k],vertices[(k+1)%3],tip]) positions.push(v.x,v.y,v.z);
  }
  const facets=new THREE.BufferGeometry();
  facets.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));facets.computeVertexNormals();
  add(facets,new THREE.MeshStandardMaterial({color:'#a9aaa0',roughness:.9,side:THREE.DoubleSide}),'Relevo triangular do vaso');
  const crownY=3.25;
  const trunkCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,height*.85,0),new THREE.Vector3(.02,1.65,0),new THREE.Vector3(.12,crownY,.04)]);
  add(new THREE.TubeGeometry(trunkCurve,24,.065,9,false),bark,'Tronco levemente curvo');
  for(let i=0;i<23;i++) {
    const t=i/23,p=trunkCurve.getPoint(t);
    const ring=add(new THREE.TorusGeometry(.066,.004,3,10),dark,'Anel do tronco');
    ring.rotation.x=Math.PI/2;ring.position.copy(p);
  }
  for(let frond=0;frond<11;frond++) {
    const angle=frond*Math.PI*2/11, length=1.05+(frond%3)*.19;
    const dir=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const side=new THREE.Vector3(-dir.z,0,dir.x);
    const at=(t:number)=>new THREE.Vector3(.12,crownY,.04).addScaledVector(dir,length*t)
      .add(new THREE.Vector3(0,Math.sin(t*Math.PI)*.36-t*t*.46,0));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:12},(_,i)=>at(i/11))),16,.012,4,false),foliage[frond%3],'Nervura curva');
    const leaves:number[]=[];
    for(let j=1;j<19;j++) for(const sign of [-1,1]) {
      const t=j/20,base=at(t),width=.30*Math.sin(t*Math.PI)+.06;
      const tip=base.clone().addScaledVector(side,sign*width).addScaledVector(dir,.16);
      tip.y-=.13+width*.25;
      const mid=base.clone().lerp(tip,.52);mid.y+=.025;
      const left=mid.clone().addScaledVector(dir,-.025),right=mid.clone().addScaledVector(dir,.025);
      for(const v of [base,left,tip,base,tip,right]) leaves.push(v.x,v.y,v.z);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(leaves,3));geo.computeVertexNormals();
    add(geo,foliage[frond%3],'Folíolos da palmeira');
  }
}
