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
    group.position.set(Math.max(b.max.x,wallFace)+.018,b.min.y,(b.min.z+b.max.z)/2);
    const part=(name:string,x:number,y:number,z:number,d:number,h:number,w:number,mat:THREE.Material,round=false)=>{
      const g=round?new RoundedBoxGeometry(d,h,w,2,Math.min(.008,d/4,h/4,w/4)):new THREE.BoxGeometry(d,h,w);
      const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;
    };
    part('Fundo escuro das juntas',.035,height/2,0,.07,height-.035,width-.035,recess);
    const jamb=.065;
    for(const z of [-width/2+jamb/2,width/2-jamb/2])part('Batente lateral',.065,height/2,z,.13,height,jamb,frame,true);
    part('Travessa superior',.065,height-jamb/2,0,.13,jamb,width,frame,true);
    part('Travessa inferior',.065,.055,0,.13,.075,width-jamb*2,frame,true);
    const leaves=source.userData.id===23?3:1;
    const leafWidth=(width-jamb*2)/leaves;
    for(let leaf=0;leaf<leaves;leaf++) {
      const z=-width/2+jamb+leafWidth*(leaf+.5),usable=leafWidth-.018;
      // Pequenas juntas horizontais entre chapas; não são vãos vazados.
      const rows=4,base=.105,panelHeight=(height-jamb-base)/rows;
      for(let row=0;row<rows;row++)part('Chapa fechada acetinada',.083,base+panelHeight*(row+.5),z,.068,panelHeight-.012,usable,paint,true);
      for(const dz of [-usable/2+.02,usable/2-.02])part('Perfil vertical da folha',.095,(height+.04)/2,z+dz,.075,height-.12,.038,frame,true);
      if(leaf===0||leaves===1) {
        const handleZ=z+usable/2-.15,handleY=height*.43;
        for(const dy of [-.14,.14])part('Suporte puxador',.152,handleY+dy,handleZ,.08,.033,.038,frame,true);
        part('Puxador vertical',.197,handleY,handleZ,.036,.37,.036,hardware,true);
        part('Espelho da fechadura',.13,handleY-.25,handleZ,.025,.065,.042,hardware,true);
        part('Entrada da chave',.145,handleY-.25,handleZ,.008,.021,.009,recess);
      }
    }
    for(const y of [.28,height/2,height-.28])part('Dobradiça discreta',.14,y,-width/2+.10,.04,.095,.044,frame,true);
    source.visible=false;scene.add(group);
  }

  // ─── Porta do banheiro com frosted glass (ID 55) ────────────────────────────
  const bathDoor=meshes.find(m=>m.userData.id===55);
  if(bathDoor) {
    const b=new THREE.Box3().setFromObject(bathDoor);
    const width=b.max.z-b.min.z;
    const height=b.max.y-b.min.y;
    const cx=(b.min.z+b.max.z)/2;
    const faceX=b.max.x+.012; // avança ligeiramente para não coincidir

    const darkFrame=new THREE.MeshStandardMaterial({color:'#181b1c',metalness:.55,roughness:.30});
    const frosted=new THREE.MeshStandardMaterial({
      color:'#c8d8dd',
      metalness:.08,
      roughness:.05,
      transparent:true,
      opacity:.38,
      side:THREE.DoubleSide,
    });
    const hw=new THREE.MeshStandardMaterial({color:'#5a6162',metalness:.82,roughness:.25});

    const grp=new THREE.Group();grp.name='Porta banheiro frosted glass';
    grp.position.set(faceX,b.min.y,cx);

    const mk=(name:string,x:number,y:number,z:number,d:number,h:number,w:number,mat:THREE.Material,round=false)=>{
      const g=round?new RoundedBoxGeometry(d,h,w,2,Math.min(.007,d/4,h/4,w/4)):new THREE.BoxGeometry(d,h,w);
      const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;grp.add(m);
    };

    const jb=.052;
    // Batentes
    mk('Batente esquerdo',0,height/2,-width/2+jb/2,.10,height,jb,darkFrame,true);
    mk('Batente direito', 0,height/2, width/2-jb/2,.10,height,jb,darkFrame,true);
    mk('Travessa superior',0,height-jb/2,0,.10,jb,width,darkFrame,true);
    mk('Travessa inferior', 0,jb/2,0,.10,jb,width,darkFrame,true);

    // Painel de vidro jateado
    const glassW=width-jb*2-.008;
    const glassH=height-jb*2-.008;
    mk('Vidro jateado',.035,jb+glassH/2,0,.025,glassH,glassW,frosted);

    // Perfil horizontal central decorativo
    mk('Perfil horizontal',.05,height*.38,0,.055,.038,glassW-.04,darkFrame,true);

    // Puxador
    const pzOff=glassW/2-.12;
    mk('Puxador barra', .075,height*.46,pzOff,.04,.32,.028,hw,true);
    mk('Suporte puxador superior',.068,height*.46+.14,pzOff,.07,.028,.028,darkFrame,true);
    mk('Suporte puxador inferior',.068,height*.46-.14,pzOff,.07,.028,.028,darkFrame,true);

    // Dobradiças
    for(const hy of [.12,height/2,height-.12])mk('Dobradiça',.08,hy,-glassW/2+.04,.04,.09,.04,darkFrame,true);

    bathDoor.visible=false;
    scene.add(grp);
  }

  // ─── Janela basculante acima das portas do banheiro ─────────────────────────
  // Usa o bounding box dos banheiros (56/57) para inferir a parede e o vão alto.
  const bathWall=meshes.find(m=>[56,57].includes(m.userData.id));
  const bathDoorMesh=meshes.find(m=>m.userData.id===55);
  if(bathWall&&bathDoorMesh) {
    const wb=new THREE.Box3().setFromObject(bathWall);
    const db=new THREE.Box3().setFromObject(bathDoorMesh);

    // O vão da janela fica entre o topo da porta e o teto do banheiro
    const doorTop=db.max.y;          // topo da porta
    const ceilY=wb.max.y-.02;        // teto do banheiro (ligeiro recuo)
    const windowH=ceilY-doorTop;     // altura do vão disponível
    if(windowH>.10) {               // só cria se houver espaço real
      const windowW=db.max.z-db.min.z; // mesma largura da porta
      const wcx=(db.min.z+db.max.z)/2;
      const faceX=db.max.x+.015;

      const darkFrame2=new THREE.MeshStandardMaterial({color:'#181b1c',metalness:.55,roughness:.30});
      const glass2=new THREE.MeshStandardMaterial({
        color:'#b8cdd4',
        metalness:.10,
        roughness:.04,
        transparent:true,
        opacity:.30,
        side:THREE.DoubleSide,
      });

      const wgrp=new THREE.Group();wgrp.name='Janela basculante banheiro';
      wgrp.position.set(faceX,doorTop,wcx);

      const wk=(name:string,x:number,y:number,z:number,d:number,h:number,w:number,mat:THREE.Material)=>{
        const g=new THREE.BoxGeometry(d,h,w);
        const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;wgrp.add(m);
      };

      const jb2=.042;
      // Caixilho externo
      wk('Caixilho esquerdo',0,windowH/2,-windowW/2+jb2/2,.08,windowH,jb2,darkFrame2);
      wk('Caixilho direito', 0,windowH/2, windowW/2-jb2/2,.08,windowH,jb2,darkFrame2);
      wk('Caixilho superior',0,windowH-jb2/2,0,.08,jb2,windowW,darkFrame2);
      wk('Caixilho inferior', 0,jb2/2,0,.08,jb2,windowW,darkFrame2);

      // Vidros: 2 folhas basculantes (painéis divididos horizontalmente)
      const panes=2;
      const paneH=(windowH-jb2*2-.006*(panes-1))/panes;
      const paneW=windowW-jb2*2-.008;
      for(let i=0;i<panes;i++) {
        const py=jb2+paneH/2+i*(paneH+.006);
        // Inclinação leve para simular basculante aberto
        const tilt=(i%2===0)?-0.08:0.06;
        const vm=new THREE.Mesh(new THREE.BoxGeometry(.018,paneH-.008,paneW),glass2);
        vm.name=`Folha basculante ${i+1}`;
        vm.position.set(.025,py,0);
        vm.rotation.z=tilt;
        vm.castShadow=true;
        wgrp.add(vm);
        // Perfil divisor horizontal entre panos
        if(i<panes-1)wk(`Perfil divisor ${i+1}`,0,jb2+(i+1)*(paneH+.006)-.003,.0,.06,.016,paneW,darkFrame2);
      }

      scene.add(wgrp);
    }
  }
}
