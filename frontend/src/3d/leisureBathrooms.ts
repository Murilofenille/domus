import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Esquadrias nas duas faces reais do bloco, com orientação externa. */
export function refineBathrooms(scene:THREE.Scene,meshes:THREE.Mesh[]) {
  const black=new THREE.MeshStandardMaterial({color:'#171c1e',roughness:.4,metalness:.4});
  const panel=new THREE.MeshStandardMaterial({color:'#272e30',roughness:.46,metalness:.24});
  const glass=new THREE.MeshStandardMaterial({color:'#283c43',roughness:.24,metalness:.35});
  const shadow=new THREE.MeshStandardMaterial({color:'#080d0f',roughness:.9});
  const silver=new THREE.MeshStandardMaterial({color:'#a8ada9',roughness:.3,metalness:.8});
  const roof=meshes.find(m=>m.userData.id===38);
  const rb=roof?new THREE.Box3().setFromObject(roof):null;
  function part(group:THREE.Group,name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material) {
    const geo=new RoundedBoxGeometry(w,h,d,1,Math.min(.004,w/4,h/4,d/4));
    const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;
  }
  for(const door of meshes.filter(m=>[52,55].includes(m.userData.id))) {
    const b=new THREE.Box3().setFromObject(door),thinX=b.max.x-b.min.x<b.max.z-b.min.z;
    const wall=meshes.find(m=>m.userData.id===(thinX?57:56));
    const wb=wall?new THREE.Box3().setFromObject(wall):b;
    const width=thinX?b.max.z-b.min.z:b.max.x-b.min.x,height=b.max.y-b.min.y;
    const group=new THREE.Group();group.name=`Esquadria banheiro ${door.userData.id}`;
    // z local aponta para o pátio, nunca para dentro da parede.
    group.rotation.y=thinX?-Math.PI/2:Math.PI;
    group.position.set(thinX?wb.min.x+.02:(b.min.x+b.max.x)/2,b.min.y,thinX?(b.min.z+b.max.z)/2:wb.min.z+.02);
    const frame=.045;
    part(group,'Folha escura fechada',0,height/2,.024,width-.04,height-.03,.042,panel);
    for(const x of [-width/2+frame/2,width/2-frame/2])part(group,'Batente preto',x,height/2,.044,frame,height,.085,black);
    for(const y of [.025,height-.023])part(group,'Travessa da porta',0,y,.044,width,.045,.085,black);
    // Frisos sutis, sem transparência falsa sobre uma parede maciça.
    for(const y of [height*.22,height*.48,height*.74])part(group,'Junta do painel',0,y,.048,width-frame*2,.008,.006,shadow);
    const hx=width/2-.12,hy=height*.48;
    part(group,'Roseta da maçaneta',hx,hy,.063,.042,.095,.024,silver);
    part(group,'Maçaneta alavanca',hx-.04,hy+.012,.085,.11,.022,.023,silver);
    for(const y of [.2,height-.2])part(group,'Dobradiça preta',-width/2+.065,y,.06,.024,.075,.028,black);
    // Bandeira superior: caixilho preto com duas folhas de vidro escuro.
    // Lê as arestas internas do vão no OBJ, inclusive a janela deslocada da porta.
    const wp=wall?.geometry.attributes.position;
    const horizontal=thinX?'z':'x';
    const values=(axis:'x'|'y'|'z')=>wp?[...new Set(Array.from({length:wp.count},(_,i)=>axis==='x'?wp.getX(i):axis==='y'?wp.getY(i):wp.getZ(i)))].filter(v=>v>wb.min[axis]+.001&&v<wb.max[axis]-.001).sort((a,b)=>a-b):[];
    const us=values(horizontal),ys=values('y');
    const windowBase=(ys[0]??b.max.y+.1)-b.min.y-.015;
    const wh=ys.length>=2?ys[ys.length-1]-ys[0]+.03:0;
    const windowWidth=us.length>=2?us[us.length-1]-us[0]+.03:width;
    const offset=us.length>=2?((us[0]+us[us.length-1])/2-group.position[horizontal])*(thinX?1:-1):0;
    if(wh>.12) {
      const windowStart=group.children.length;
      const width=windowWidth;
      part(group,'Fundo do vão superior',0,windowBase+wh/2,.018,width,wh,.02,shadow);
      for(const x of [-width/2+frame/2,width/2-frame/2])part(group,'Caixilho janela',x,windowBase+wh/2,.047,frame,wh,.075,black);
      for(const y of [windowBase+frame/2,windowBase+wh-frame/2])part(group,'Travessa janela',0,y,.047,width,frame,.075,black);
      const paneW=(width-frame*3)/2;
      for(const x of [-(paneW+frame)/2,(paneW+frame)/2])part(group,'Vidro escuro da janela',x,windowBase+wh/2,.038,paneW,wh-frame*2,.015,glass);
      part(group,'Montante janela',0,windowBase+wh/2,.053,frame,wh,.08,black);
      for(const piece of group.children.slice(windowStart))piece.position.x+=offset;
    }
    door.visible=false;scene.add(group);
  }
  if(rb&&roof) {
    // Platibanda perimetral, não um teto maciço preto cobrindo todo o bloco.
    const group=new THREE.Group();group.name='Platibanda preta dos banheiros';
    const t=.14,h=.44,over=.14;
    const x0=rb.min.x-over,x1=rb.max.x+over,z0=rb.min.z-over,z1=rb.max.z+over;
    for(const x of [x0+t/2,x1-t/2])part(group,'Faixa lateral preta',x,rb.max.y+h/2,(z0+z1)/2,t,h,z1-z0,black);
    for(const z of [z0+t/2,z1-t/2])part(group,'Faixa frontal preta',(x0+x1)/2,rb.max.y+h/2,z,x1-x0-2*t,h,t,black);
    roof.material=new THREE.MeshStandardMaterial({color:'#777b78',roughness:.95});
    scene.add(group);
  }
}
