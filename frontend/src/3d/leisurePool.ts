import * as THREE from 'three';

type Cell = {x0:number;x1:number;z0:number;z1:number;bed:number;rim:number;kind:number};
type Vertex = {p:THREE.Vector3;n:THREE.Vector3;uv:THREE.Vector2};

// Geometria de níveis aproximados; contorno e posição vêm do OBJ, não das profundidades.
export function rebuildPools(scene:THREE.Scene, meshes:THREE.Mesh[], tile:THREE.Material, coping:THREE.Material) {
  const floor=meshes.find(m=>m.userData.id===25);
  const hydro=meshes.find(m=>m.userData.id===3),pool=meshes.find(m=>m.userData.id===5);
  if(!floor||!hydro||!pool) return;
  const ground=new THREE.Box3().setFromObject(floor).max.y;
  const hb=new THREE.Box3().setFromObject(hydro);
  const deck=meshes.find(m=>m.userData.id===49);
  const hydroRim=(deck?new THREE.Box3().setFromObject(deck).max.y:.3)+.12;
  const triangles:number[][]=[];
  pool.geometry.computeBoundingBox();
  const top=pool.geometry.boundingBox!.max.y;
  const p=pool.geometry.attributes.position;
  // Pequeno recuo lateral indicado no guia; valor aproximado na escala do OBJ.
  const poolSide = hb.min.z + .40;
  const xs=new Set<number>([hb.min.x,hb.max.x,hb.min.x+.50,hb.max.x-.50]);
  const zs=new Set<number>([hb.min.z,hb.max.z,hb.min.z+.50,hb.max.z-.50]);
  for(let i=0;i<p.count;i+=3) {
    if([0,1,2].every(k=>Math.abs(p.getY(i+k)-top)<.0001)) {
      const tri:number[]=[];
      for(let k=0;k<3;k++){const x=p.getX(i+k),z=Math.max(p.getZ(i+k),poolSide);tri.push(x,z);xs.add(x);zs.add(z);}
      triangles.push(tri);
    }
  }
  function inside(x:number,z:number) {
    return triangles.some(t=>{
      const cross=(a:number,b:number,c:number,d:number)=>(c-a)*(z-b)-(d-b)*(x-a);
      const a=cross(t[0],t[1],t[2],t[3]),b=cross(t[2],t[3],t[4],t[5]),c=cross(t[4],t[5],t[0],t[1]);
      return (a>=-1e-6&&b>=-1e-6&&c>=-1e-6)||(a<=1e-6&&b<=1e-6&&c<=1e-6);
    });
  }
  const xx=[...xs].sort((a,b)=>a-b),zz=[...zs].sort((a,b)=>a-b);
  const cells=new Map<string,Cell>();
  for(let i=0;i<xx.length-1;i++)for(let j=0;j<zz.length-1;j++) {
    const x=(xx[i]+xx[i+1])/2,z=(zz[j]+zz[j+1])/2;
    const spa=x>hb.min.x&&x<hb.max.x&&z>hb.min.z&&z<hb.max.z;
    if(!spa&&!inside(x,z))continue;
    const inner=spa&&x>hb.min.x+.50&&x<hb.max.x-.50&&z>hb.min.z+.50&&z<hb.max.z-.50;
    const depth=spa?(inner?1.0:.48):(x<hb.max.x?.30:z>.30?.72:1.35);
    cells.set(`${i},${j}`,{x0:xx[i],x1:xx[i+1],z0:zz[j],z1:zz[j+1],bed:(spa?hydroRim:ground)-depth,rim:spa?hydroRim:ground,kind:spa?3:5});
  }
  // Recorta todas as faces do piso mantendo seus grupos de materiais e UVs.
  const original=floor.geometry.index?floor.geometry.toNonIndexed():floor.geometry;
  const fp=original.attributes.position,fn=original.attributes.normal,fu=original.attributes.uv;
  const out:number[]=[],normals:number[]=[],uv:number[]=[];
  const result=new THREE.BufferGeometry();
  function split(poly:Vertex[],axis:'x'|'z',value:number,less:boolean) {
    const res:Vertex[]=[];
    const test=(v:Vertex)=>less?v.p[axis]<=value:v.p[axis]>=value;
    for(let i=0;i<poly.length;i++) {
      const a=poly[i],b=poly[(i+1)%poly.length],ai=test(a),bi=test(b);
      if(ai)res.push(a);
      if(ai!==bi){const t=(value-a.p[axis])/(b.p[axis]-a.p[axis]);res.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});}
    }
    return res;
  }
  for(const group of original.groups.length?original.groups:[{start:0,count:fp.count,materialIndex:0}]) {
    const start=out.length/3;
    for(let i=group.start;i<group.start+group.count;i+=3){
      let polygons:Vertex[][]=[[0,1,2].map(k=>({p:new THREE.Vector3().fromBufferAttribute(fp,i+k),n:new THREE.Vector3().fromBufferAttribute(fn,i+k),uv:new THREE.Vector2(fu.getX(i+k),fu.getY(i+k))}))];
      for(const cell of cells.values()) {
        // Retira também o piso sob a pedra externa: topo nivelado sem faces coplanares.
        const width=cell.kind===5?.24:.05;
        const c={x0:cell.x0-width,x1:cell.x1+width,z0:cell.z0-width,z1:cell.z1+width};
        const next:Vertex[][]=[];
        for(const poly of polygons){
          if(poly.every(v=>v.p.x<=c.x0)||poly.every(v=>v.p.x>=c.x1)||poly.every(v=>v.p.z<=c.z0)||poly.every(v=>v.p.z>=c.z1)){next.push(poly);continue;}
          let remainder=poly;
          for(const [axis,value,less] of [['x',c.x0,true],['x',c.x1,false],['z',c.z0,true],['z',c.z1,false]] as const){
            const outside=split(remainder,axis,value,less);if(outside.length>=3)next.push(outside);
            remainder=split(remainder,axis,value,!less);if(remainder.length<3)break;
          }
        }
        polygons=next;
      }
      for(const poly of polygons)for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){out.push(v.p.x,v.p.y,v.p.z);normals.push(v.n.x,v.n.y,v.n.z);uv.push(v.uv.x,v.uv.y);}
    }
    result.addGroup(start,out.length/3-start,group.materialIndex);
  }
  result.setAttribute('position',new THREE.Float32BufferAttribute(out,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.computeBoundingSphere();floor.geometry=result;
  const shell:number[]=[],waterCoords:Record<number,number[]>={3:[],5:[]};
  function quad(target:number[],a:number[],b:number[],c:number[],d:number[]){target.push(...a,...b,...c,...a,...c,...d);}
  const strips:{x0:number;x1:number;z0:number;z1:number;kind:number;rim:number}[]=[];
  function stone(c:Cell,side:number) {
    const w=.24, extra=c.kind===3?.05:0;
    if(c.kind===5) {
      // Face interna da pedra alinhada à parede; largura inteira do lado do piso.
      strips.push({kind:c.kind,rim:c.rim,
        x0:side===0?c.x0-w:side===1?c.x1:c.x0-w,
        x1:side===0?c.x0:side===1?c.x1+w:c.x1+w,
        z0:side===2?c.z0-w:side===3?c.z1:c.z0-w,
        z1:side===2?c.z0:side===3?c.z1+w:c.z1+w});
      return;
    }
    // Estende as pontas para fechar encontros em L. A união abaixo remove sobreposições.
    strips.push({kind:c.kind,rim:c.rim,
      x0:side===0?c.x0-extra:side===1?c.x1-w:c.x0-w,
      x1:side===0?c.x0+w:side===1?c.x1+extra:c.x1+w,
      z0:side===2?c.z0-extra:side===3?c.z1-w:c.z0-w,
      z1:side===2?c.z0+w:side===3?c.z1+extra:c.z1+w});
  }
  for(const [key,c]of cells){
    const [i,j]=key.split(',').map(Number);
    quad(shell,[c.x0,c.bed,c.z0],[c.x0,c.bed,c.z1],[c.x1,c.bed,c.z1],[c.x1,c.bed,c.z0]);
    const y=c.rim-.085;
    quad(waterCoords[c.kind],[c.x0,y,c.z0],[c.x0,y,c.z1],[c.x1,y,c.z1],[c.x1,y,c.z0]);
    const edges=[[[c.x0,c.z0],[c.x0,c.z1]],[[c.x1,c.z1],[c.x1,c.z0]],[[c.x1,c.z0],[c.x0,c.z0]],[[c.x0,c.z1],[c.x1,c.z1]]];
    const neighbours=[cells.get(`${i-1},${j}`),cells.get(`${i+1},${j}`),cells.get(`${i},${j-1}`),cells.get(`${i},${j+1}`)];
    edges.forEach(([a,b],s)=>{
      const n=neighbours[s],upper=!n?c.rim:n.kind!==c.kind?Math.max(c.rim,n.rim):n.bed;
      if(upper>c.bed+1e-6)quad(shell,[a[0],c.bed,a[1]],[b[0],c.bed,b[1]],[b[0],upper,b[1]],[a[0],upper,a[1]]);
      if(!n||(c.kind===3&&n.kind!==3))stone(c,s);
    });
  }
  // Uma malha contínua por borda: sem caixas coplanares piscando nos cantos.
  for(const kind of [3,5]) {
    const rectangles=strips.filter(s=>s.kind===kind);
    const sx=[...new Set([...rectangles.flatMap(s=>[s.x0,s.x1]),...xx])].sort((a,b)=>a-b);
    const sz=[...new Set([...rectangles.flatMap(s=>[s.z0,s.z1]),...zz])].sort((a,b)=>a-b);
    const occupied=new Set<string>();
    for(let i=0;i<sx.length-1;i++)for(let j=0;j<sz.length-1;j++) {
      const x=(sx[i]+sx[i+1])/2,z=(sz[j]+sz[j+1])/2;
      if(!rectangles.some(s=>x>s.x0&&x<s.x1&&z>s.z0&&z<s.z1))continue;
      const inFootprint=kind===3
        ? x>=hb.min.x-.05&&x<=hb.max.x+.05&&z>=hb.min.z-.05&&z<=hb.max.z+.05
        : ![...cells.values()].some(c=>x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1);
      if(inFootprint)occupied.add(`${i},${j}`);
    }
    const vertices:number[]=[],y=(kind===3?hydroRim:ground)+.008,bottom=y-.074;
    for(const key of occupied){
      const [i,j]=key.split(',').map(Number),a=sx[i],b=sx[i+1],c=sz[j],d=sz[j+1];
      quad(vertices,[a,y,c],[a,y,d],[b,y,d],[b,y,c]);
      quad(vertices,[a,bottom,c],[b,bottom,c],[b,bottom,d],[a,bottom,d]);
      if(!occupied.has(`${i-1},${j}`))quad(vertices,[a,y,c],[a,bottom,c],[a,bottom,d],[a,y,d]);
      if(!occupied.has(`${i+1},${j}`))quad(vertices,[b,y,d],[b,bottom,d],[b,bottom,c],[b,y,c]);
      if(!occupied.has(`${i},${j-1}`))quad(vertices,[b,y,c],[b,bottom,c],[a,bottom,c],[a,y,c]);
      if(!occupied.has(`${i},${j+1}`))quad(vertices,[a,y,d],[a,bottom,d],[b,bottom,d],[b,y,d]);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    const border=new THREE.Mesh(g,coping);border.name=kind===3?'Borda hidro com avanço externo':'Borda piscina contínua rente ao piso';
    border.castShadow=border.receiveShadow=true;scene.add(border);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(shell,3));geo.computeVertexNormals();
  const tex:number[]=[];const gp=geo.attributes.position,gn=geo.attributes.normal;
  for(let i=0;i<gp.count;i++){if(Math.abs(gn.getY(i))>.5)tex.push(gp.getX(i)/.8,gp.getZ(i)/.8);else tex.push((Math.abs(gn.getX(i))>.5?gp.getZ(i):gp.getX(i))/.8,gp.getY(i)/.8);}
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
  const lining=tile.clone();lining.side=THREE.DoubleSide;
  const tank=new THREE.Mesh(geo,lining);tank.name='Tanques com patamares e espelhos verticais';tank.receiveShadow=tank.castShadow=true;scene.add(tank);
  pool.visible=hydro.visible=false;
  for(const id of [3,5]){
    const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(waterCoords[id],3));wg.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:'#379da5',roughness:.14,metalness:.12,transparent:true,opacity:.30,depthWrite:false});
    mat.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 vPoolPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPoolPosition=position;');
      shader.fragmentShader='varying vec3 vPoolPosition;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(sin(vPoolPosition.x*19.0+vPoolPosition.z*13.0)*.045,cos(vPoolPosition.z*25.0-vPoolPosition.x*8.0)*.04,0.0));');
    };
    const water=new THREE.Mesh(wg,mat);water.name=id===3?'Água hidro':'Água piscina — nível único';water.renderOrder=2;scene.add(water);
  }
}
