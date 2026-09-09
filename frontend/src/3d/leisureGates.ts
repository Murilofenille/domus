import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Painéis fechados e ferragens discretas, baseados na foto do salão. */
export function refineGates(scene:THREE.Scene,meshes:THREE.Mesh[]) {
  const paint=new THREE.MeshStandardMaterial({color:'#272b2c',metalness:.42,roughness:.43});
  const frame=new THREE.MeshStandardMaterial({color:'#171b1c',metalness:.52,roughness:.34});
  const recess=new THREE.MeshStandardMaterial({color:'#101314',metalness:.1,roughness:.78});
  const hardware=new THREE.MeshStandardMaterial({color:'#646b6c',metalness:.78,roughness:.3});
  const frontWall=meshes.find(m=>m.userData.id===29);
  const wallFace=frontWall?new THREE.Box3().setFromObject(frontWall).max.x:-Infinity;
  for(const source of meshes.filter(m=>[22,23].includes(m.userData.id))) {
    const b=new THREE.Box3().setFromObject(source),width=b.max.z-b.min.z,height=b.max.y-b.min.y;
    const group=new THREE.Group();group.name=source.userData.id===22?'Portão social detalhado':'Portão principal detalhado';
    // A face do portão fica à frente da alvenaria, sem superfícies coincidentes.
    group.position.set(Number.isFinite(wallFace)?wallFace-.05:b.max.x-.05,b.min.y,(b.min.z+b.max.z)/2);
    const part=(name:string,x:number,y:number,z:number,d:number,h:number,w:number,mat:THREE.Material,round=false)=>{
      const g=round?new RoundedBoxGeometry(d,h,w,2,Math.min(.008,d/4,h/4,w/4)):new THREE.BoxGeometry(d,h,w);
      const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;
    };
    part('Fundo escuro das juntas',.035,height/2,0,.07,height-.035,width-.035,recess);
    const jamb=.065;
    for(const z of [-width/2+jamb/2,width/2-jamb/2])part('Batente lateral',.065,height/2,z,.13,height,jamb,frame,true);
    part('Travessa superior',.065,height-jamb/2,0,.13,jamb,width,frame,true);
    part('Travessa inferior',.065,.055,0,.13,.075,width-jamb*2,frame,true);
    part('Arremate superior do portão',.06,height+.012,0,.17,.024,width+.02,frame,true);
    part('Soleira metálica',.055,.009,0,.18,.018,width,hardware,true);
    const leaves=source.userData.id===23?3:1;
    const leafWidth=(width-jamb*2)/leaves;
    for(let leaf=0;leaf<leaves;leaf++) {
      const z=-width/2+jamb+leafWidth*(leaf+.5),usable=leafWidth-.018;
      // Pequenas juntas horizontais entre chapas; não são vãos vazados.
      const rows=4,base=.105,panelHeight=(height-jamb-base)/rows;
      for(let row=0;row<rows;row++)part('Chapa fechada acetinada',.083,base+panelHeight*(row+.5),z,.068,panelHeight-.012,usable,paint,true);
      for(const dz of [-usable/2+.02,usable/2-.02])part('Perfil vertical da folha',.095,(height+.04)/2,z+dz,.075,height-.12,.038,frame,true);
      if(leaves===1) {
        const handleZ=z+usable/2-.15,handleY=height*.43;
        for(const dy of [-.14,.14])part('Suporte puxador',.152,handleY+dy,handleZ,.08,.033,.038,frame,true);
        part('Puxador vertical',.197,handleY,handleZ,.036,.37,.036,hardware,true);
        part('Espelho da fechadura',.13,handleY-.25,handleZ,.025,.065,.042,hardware,true);
        part('Entrada da chave',.145,handleY-.25,handleZ,.008,.021,.009,recess);
      }
    }
    for(const y of [.28,height/2,height-.28])part('Dobradiça discreta',.14,y,-width/2+.10,.04,.095,.044,frame,true);
    if(source.userData.id===23)part('Guia superior discreta',.145,height-.085,0,.04,.028,width-.16,frame,true);
    source.visible=false;scene.add(group);
  }

}
