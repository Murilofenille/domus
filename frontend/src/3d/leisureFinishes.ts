import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { applyFloorFinishes } from './leisureFloors';
import { refineGarden } from './leisureGarden';
import { rebuildPools } from './leisurePool';
import { refineGates } from './leisureGates';

// Seamless textures geradas via HTML Canvas procedural
function texture(kind: 'tile' | 'brick' | 'paving'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  let seed = 71;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = kind === 'tile' ? '#8aa5af' : kind === 'brick' ? '#8f7961' : '#b5a38c';
  ctx.fillRect(0, 0, 512, 512);
  const rows = kind === 'tile' ? 16 : kind === 'brick' ? 10 : 4;
  const cols = kind === 'tile' ? 16 : kind === 'brick' ? 4 : 2;
  const w = 512 / cols, h = 512 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = -1; x < cols + 1; x++) {
      const v = rand();
      const px = x * w + (kind === 'brick' && y % 2 ? w / 2 : 0);
      ctx.fillStyle = kind === 'tile'
        ? `hsl(${204 + v * 8} 73% ${25 + v * 20}%)`
        : kind === 'brick'
          ? `hsl(${30 + v * 5} ${30 + v * 12}% ${44 + v * 19}%)`
          : `hsl(34 23% ${67 + v * 7}%)`;
      ctx.fillRect(px + 1.5, y * h + 1.5, w - 3, h - 3);
      for (let n = 0; n < 80; n++) {
        ctx.fillStyle = rand() > 0.5 ? '#ffffff0d' : '#0000000a';
        ctx.fillRect(px + rand() * w, y * h + rand() * h, rand() * 12 + 1, 1);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Mapas de relevo para filetes de pedra natural
function stoneMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  color.width = color.height = height.width = height.height = 1024;
  const c = color.getContext('2d')!;
  const h = height.getContext('2d')!;
  c.fillStyle = '#665847';
  c.fillRect(0, 0, 1024, 1024);
  h.fillStyle = '#242424';
  h.fillRect(0, 0, 1024, 1024);
  let seed = 527;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const palette = ['#a78c64', '#b59c78', '#8b775e', '#c0aa87', '#998264', '#796b59', '#b39870'];
  for (let row = 0; row < 16; row++) {
    let x = -Math.floor(rand() * 180);
    const y = row * 64;
    while (x < 1024) {
      const w = 90 + Math.floor(rand() * 190);
      const level = 95 + Math.floor(rand() * 130);
      for (const shift of [-1024, 0, 1024]) {
        const px = x + shift;
        c.fillStyle = palette[Math.floor(rand() * palette.length)];
        c.fillRect(px + 1, y + 1, w - 2, 62);
        h.fillStyle = `rgb(${level},${level},${level})`;
        h.fillRect(px + 1, y + 1, w - 2, 62);
        c.fillStyle = '#ffffff1c';
        c.fillRect(px + 2, y + 2, w - 4, 2);
        c.fillStyle = '#00000026';
        c.fillRect(px + 2, y + 59, w - 4, 3);
        for (let i = 0; i < 45; i++) {
          c.fillStyle = rand() > 0.5 ? '#ffffff0d' : '#0000000c';
          ctxRect(c, px + rand() * w, y + rand() * 62, 3 + rand() * 22, 1 + rand() * 2);
        }
      }
      x += w;
    }
  }
  const map = new THREE.CanvasTexture(color);
  const bump = new THREE.CanvasTexture(height);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

function ctxRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillRect(x, y, w, h);
}

function worldUV(geo: THREE.BufferGeometry, scale: number) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    if (ny >= nx && ny >= nz) uv.push(p.getX(i) / scale, p.getZ(i) / scale);
    else if (nx > nz) uv.push(p.getZ(i) / scale, p.getY(i) / scale);
    else uv.push(p.getX(i) / scale, p.getY(i) / scale);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

// Textura procedural de facho de luz (cone duplo para cima e para baixo) para arandelas
function createArandelaBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  const cx = 128;
  const cy = 256;

  // Cone superior (facho de luz para cima)
  const gradUp = ctx.createRadialGradient(cx, cy, 4, cx, cy - 60, 190);
  gradUp.addColorStop(0, 'rgba(255, 205, 120, 0.95)');
  gradUp.addColorStop(0.2, 'rgba(255, 170, 70, 0.70)');
  gradUp.addColorStop(0.55, 'rgba(255, 130, 30, 0.28)');
  gradUp.addColorStop(1, 'rgba(255, 100, 10, 0.0)');

  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(246, 12);
  ctx.lineTo(10, 12);
  ctx.closePath();
  ctx.fillStyle = gradUp;
  ctx.fill();

  // Cone inferior (facho de luz para baixo)
  const gradDown = ctx.createRadialGradient(cx, cy, 4, cx, cy + 60, 210);
  gradDown.addColorStop(0, 'rgba(255, 205, 120, 0.95)');
  gradDown.addColorStop(0.2, 'rgba(255, 170, 70, 0.70)');
  gradDown.addColorStop(0.55, 'rgba(255, 130, 30, 0.28)');
  gradDown.addColorStop(1, 'rgba(255, 100, 10, 0.0)');

  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(248, 500);
  ctx.lineTo(8, 500);
  ctx.closePath();
  ctx.fillStyle = gradDown;
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface FinishSceneResult {
  update: (t: number) => void;
  setNight: (on: boolean) => void;
  setArandelas: (on: boolean) => void;
  setStairLight: (on: boolean) => void;
  setGourmetLight: (on: boolean) => void;
  setPoolLight: (on: boolean) => void;
  setWallScale: (scaleY: number) => void;
  setUpperVisible: (visible: boolean) => void;
  getCenterCoordinates: () => {
    stairs: [number, number, number];
    arandelas: [number, number, number];
    gourmet: [number, number, number];
    pool: [number, number, number];
  };
}

export function finishScene(
  scene: THREE.Scene,
  meshes: THREE.Mesh[],
  renderer: THREE.WebGLRenderer,
  walls: THREE.Mesh[],
  upperMeshes: THREE.Mesh[]
): FinishSceneResult {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.05);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.09;
  room.dispose();
  pmrem.dispose();

  const bricks = texture('brick');
  const tiles = texture('tile');
  const paving = texture('paving');

  const brick = new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.91 });
  const stoneTexture = stoneMaps();
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture.map, bumpMap: stoneTexture.bump, bumpScale: 0.045, roughness: 0.89 });
  const pavingMat = new THREE.MeshStandardMaterial({ map: paving, roughness: 0.8 });
  const plaster = new THREE.MeshStandardMaterial({ color: '#8b8c87', roughness: 0.92 });
  const metal = new THREE.MeshStandardMaterial({ color: '#171b1d', metalness: 0.48, roughness: 0.34 });
  const granite = new THREE.MeshStandardMaterial({ color: '#202326', roughness: 0.23, metalness: 0.22 });
  const coping = new THREE.MeshStandardMaterial({ color: '#e3d7bd', roughness: 0.65 });
  const poolTile = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.33, metalness: 0.07 });
  const glowingArandelas = new THREE.MeshStandardMaterial({
    color: '#221a12',
    emissive: '#ff9d3b',
    emissiveIntensity: 0.0,
    roughness: 0.2
  });

  const brickIDs = new Set([4, 6, 7, 8, 24, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48]);
  const stoneIDs = new Set([11, 15, 16]);
  const graniteIDs = new Set([9, 10, 13, 18]);
  const byId = new Map(meshes.map(m => [m.userData.id, m]));
  refineGarden(scene, meshes);
  refineGates(scene, meshes);

  const arandelaLights: THREE.PointLight[] = [];
  const wallBeams: THREE.Mesh[] = [];
  const beamTex = createArandelaBeamTexture();
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    obj.name = name;
    obj.position.set(x, y, z);
    obj.castShadow = true;
    obj.receiveShadow = true;
    scene.add(obj);
    return obj;
  }

  for (const mesh of meshes) {
    const id = mesh.userData.id;
    if (brickIDs.has(id)) { worldUV(mesh.geometry, 1.15); mesh.material = brick; }
    if (stoneIDs.has(id)) { worldUV(mesh.geometry, 1.28); mesh.material = stone; }
    if (graniteIDs.has(id)) mesh.material = granite;
    if ([0, 1, 26, 29, 56, 57].includes(id)) mesh.material = plaster;
    if (id === 25) { worldUV(mesh.geometry, 2.4); mesh.material = pavingMat; }
    if ([22, 23, 52, 55].includes(id)) mesh.material = metal;
  }

  // Muros laterais altos (ID 50 e 54): ajustados para altura padrão (2.8m), cor preta e deslocados para dentro (evitando conflito com as paredes)
  const blackWallMat = new THREE.MeshStandardMaterial({
    color: '#181a1c',
    roughness: 0.85,
    metalness: 0.12
  });

  const wall50 = byId.get(50);
  if (wall50) {
    wall50.scale.y = 2.8 / 5.8;
    wall50.material = blackWallMat;
    wall50.position.y -= 0.05;
    wall50.position.z += 0; // Desloca para dentro do pátio
    wall50.position.x += 0; // Desloca para frente (longe do fundo)
    walls.push(wall50);
  }

  const wall54 = byId.get(54);
  if (wall54) {
    wall54.scale.y = 2.8 / 5.8;
    wall54.scale.x = 1; // Reduz o comprimento para não colidir com o tijolo
    wall54.material = blackWallMat;
    wall54.position.y -= 0.05;
    wall54.position.z -= 0.05; // Desloca para dentro do pátio
    wall54.position.x += 1.3; // Desloca para frente (começa exatamente onde o tijolo termina)
    walls.push(wall54);
  }

  const baseFloor = byId.get(25);
  const slab = byId.get(31);
  if (baseFloor) {
    const divider = slab ? new THREE.Box3().setFromObject(slab).max.x : -2.4;
    applyFloorFinishes(baseFloor, byId.get(49), divider);
  }

  rebuildPools(scene, meshes, poolTile, coping);
  let poolLight: THREE.PointLight | null = null;

  // Luz subaquática da piscina (RGB / Cyan glow)
  const poolCenter = byId.get(5);
  if (poolCenter) {
    const pb = new THREE.Box3().setFromObject(poolCenter);
    poolLight = new THREE.PointLight('#00f0ff', 0, 10, 1.6);
    poolLight.position.set((pb.min.x + pb.max.x) / 2, pb.max.y - 0.2, (pb.min.z + pb.max.z) / 2);
    scene.add(poolLight);
  }

  // Arandelas ao longo dos muros do pátio: feixe em cada spot (Sugestão 1) + 2 PointLights difusas leves
  const beamGeo = new THREE.PlaneGeometry(1.4, 2.0);
  for (const x of [1.5, 4.6, 7.7, 10.8]) {
    for (const z of [-4.83, 4.83]) {
      box('Arandela preta', x, 1.85, z, 0.17, 0.4, 0.13, metal);
      box('Difusor da arandela', x, 1.85, z + (z < 0 ? 0.075 : -0.075), 0.11, 0.3, 0.022, glowingArandelas);

      // Facho de luz suave colado no muro (efeito visual de arandela real)
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(x, 1.85, z < 0 ? -4.89 : 4.89);
      if (z > 0) beamMesh.rotation.y = Math.PI;
      beamMesh.visible = false;
      scene.add(beamMesh);
      wallBeams.push(beamMesh);
    }
  }

  // Apenas 2 luzes de longo alcance difusas (1 em cada muro) para iluminação real no chão com custo mínimo
  const lampLeft = new THREE.PointLight('#ff9d3b', 0, 14.0, 1.8);
  lampLeft.position.set(6.15, 1.85, -4.30);
  const lampRight = new THREE.PointLight('#ff9d3b', 0, 14.0, 1.8);
  lampRight.position.set(6.15, 1.85, 4.30);
  arandelaLights.push(lampLeft, lampRight);

  // Iluminação dedicada da Escada (Sonoff Luz Escada)
  const stairMesh = byId.get(54);
  let stairLight: THREE.PointLight | null = null;
  let stairPos: [number, number, number] = [0, 1.5, 0];
  if (stairMesh) {
    const sb = new THREE.Box3().setFromObject(stairMesh);
    stairPos = [(sb.min.x + sb.max.x) / 2, sb.max.y + 0.8, (sb.min.z + sb.max.z) / 2];
    stairLight = new THREE.PointLight('#ffb356', 0, 8.5, 2.0);
    stairLight.position.set(stairPos[0], stairPos[1], stairPos[2]);
    scene.add(stairLight);
  }

  // Iluminação dedicada do Salão / Gourmet (Sonoff Iluminação Salão Inferior)
  const gourmetMesh = byId.get(10) || byId.get(9);
  const gourmetLights: { light: THREE.Light; onIntensity: number }[] = [];
  let gourmetPos: [number, number, number] = [-5.85, 2.4, -0.5];

  if (gourmetMesh) {
    const gb = new THREE.Box3().setFromObject(gourmetMesh);
    const islandX = (gb.min.x + gb.max.x) / 2;
    gourmetPos = [islandX, 2.4, 0.0];
  }

  // Sem teto na vista recortada, omite spots e pendentes flutuantes.
  // As fontes de luz abaixo continuam sincronizadas com o dispositivo.

  // 3. Apenas 2 luzes difusas amplas para o salão (substitui os 7 spots pesados por iluminação geral leve)
  const mainSalãoLight = new THREE.PointLight('#ffe8c6', 0, 11.0, 1.7);
  mainSalãoLight.position.set(-6.50, 2.40, 0.50);
  gourmetLights.push({ light: mainSalãoLight, onIntensity: 22 });

  const kitchenSalãoLight = new THREE.PointLight('#ffe0b6', 0, 9.0, 1.7);
  kitchenSalãoLight.position.set(-8.80, 2.40, -2.50);
  gourmetLights.push({ light: kitchenSalãoLight, onIntensity: 18 });

  // Refletor de Jardim / Espeto iluminando o Coqueiro (acende sincronizado com as arandelas)
  const coqueiroMesh = byId.get(12);
  let coqueiroSpot: THREE.SpotLight | null = null;
  let coqueiroPoint: THREE.PointLight | null = null;
  const glowingCoqueiroLens = new THREE.MeshStandardMaterial({
    color: '#221a12',
    emissive: '#ffb347',
    emissiveIntensity: 0.0,
    roughness: 0.2
  });

  const cBox = coqueiroMesh ? new THREE.Box3().setFromObject(coqueiroMesh) : null;
  const cCenterX = cBox ? (cBox.min.x + cBox.max.x) / 2 : 5.36;
  const cCenterZ = cBox ? (cBox.min.z + cBox.max.z) / 2 : 0.96;
  const cBaseY = cBox ? cBox.min.y : 0.10;

  // Mini refletor/espeto de jardim no solo
  box('Espeto de jardim base', cCenterX - 0.25, cBaseY + 0.05, cCenterZ - 0.35, 0.09, 0.07, 0.09, metal);
  box('Lente do espeto coqueiro', cCenterX - 0.25, cBaseY + 0.09, cCenterZ - 0.35, 0.07, 0.02, 0.07, glowingCoqueiroLens);

  // SpotLight direcionado para a copa e tronco do coqueiro
  coqueiroSpot = new THREE.SpotLight('#ffc87a', 0, 9.0, Math.PI / 3.2, 0.4, 1.8);
  coqueiroSpot.position.set(cCenterX - 0.25, cBaseY + 0.15, cCenterZ - 0.35);
  coqueiroSpot.target.position.set(cCenterX, cBaseY + 2.4, cCenterZ);
  scene.add(coqueiroSpot);
  scene.add(coqueiroSpot.target);

  // Luz pontual quente para banhar o tronco e o canteiro
  coqueiroPoint = new THREE.PointLight('#ffa63a', 0, 5.0, 2.0);
  coqueiroPoint.position.set(cCenterX - 0.1, cBaseY + 0.7, cCenterZ - 0.1);
  scene.add(coqueiroPoint);

  // Banquetas da ilha gourmet
  const island = byId.get(10);
  if (island) {
    const bounds = new THREE.Box3().setFromObject(island);
    for (const x of [-6.6, -5.3]) {
      const z = bounds.max.z + 0.43;
      for (const dx of [-0.18, 0.18]) {
        for (const dz of [-0.18, 0.18]) {
          box('Pé banqueta', x + dx, 0.48, z + dz, 0.035, 0.76, 0.035, metal);
        }
      }
      box('Assento banqueta', x, 0.9, z, 0.47, 0.09, 0.48, metal);
      box('Encosto banqueta', x, 1.14, z + 0.22, 0.47, 0.45, 0.045, metal);
    }
  }

  // Acabamento dos refrigeradores
  for (const id of [14, 20]) {
    const fridge = byId.get(id);
    if (!fridge) continue;
    const b = new THREE.Box3().setFromObject(fridge);
    const cx = (b.min.x + b.max.x) / 2;
    fridge.material = new THREE.MeshStandardMaterial({ color: '#353b3d', roughness: 0.31, metalness: 0.58 });
    box('Puxador inox', cx, 1.15, b.max.z + 0.02, b.max.x - b.min.x - 0.12, 0.035, 0.045, new THREE.MeshStandardMaterial({ color: '#bcc1c2', metalness: 0.8, roughness: 0.25 }));
  }

  return {
    update(_t: number) { },
    setNight(on: boolean) {
      // Controla a intensidade da luz ambiente/reflexiva do céu noturno
      scene.environmentIntensity = on ? 0.09 : 1.0;
    },
    setArandelas(on: boolean) {
      arandelaLights.forEach(l => {
        l.intensity = on ? 16 : 0;
        if (on) { if (!l.parent) scene.add(l); }
        else { if (l.parent) scene.remove(l); }
      });
      glowingArandelas.color.set(on ? '#ffdf9d' : '#221a12');
      glowingArandelas.emissiveIntensity = on ? 4.5 : 0.0;
      beamMat.opacity = on ? 0.90 : 0.0;
      wallBeams.forEach(b => { b.visible = on; });

      // Luz do coqueiro sincronizada com as arandelas
      if (coqueiroSpot) {
        coqueiroSpot.intensity = on ? 24 : 0;
        if (on) { if (!coqueiroSpot.parent) scene.add(coqueiroSpot); }
        else { if (coqueiroSpot.parent) scene.remove(coqueiroSpot); }
      }
      if (coqueiroPoint) {
        coqueiroPoint.intensity = on ? 12 : 0;
        if (on) { if (!coqueiroPoint.parent) scene.add(coqueiroPoint); }
        else { if (coqueiroPoint.parent) scene.remove(coqueiroPoint); }
      }
      glowingCoqueiroLens.color.set(on ? '#ffe0a0' : '#221a12');
      glowingCoqueiroLens.emissiveIntensity = on ? 5.0 : 0.0;
    },
    setStairLight(on: boolean) {
      if (stairLight) {
        stairLight.intensity = on ? 18 : 0;
        if (on) { if (!stairLight.parent) scene.add(stairLight); }
        else { if (stairLight.parent) scene.remove(stairLight); }
      }
    },
    setGourmetLight(on: boolean) {
      gourmetLights.forEach(({ light, onIntensity }) => {
        light.intensity = on ? onIntensity : 0;
        if (on) { if (!light.parent) scene.add(light); }
        else { if (light.parent) scene.remove(light); }
      });
    },
    setPoolLight(on: boolean) {
      if (poolLight) {
        poolLight.intensity = on ? 26 : 0;
        if (on) { if (!poolLight.parent) scene.add(poolLight); }
        else { if (poolLight.parent) scene.remove(poolLight); }
      }
    },
    setWallScale(scaleY: number) {
      walls.forEach(m => { m.scale.y = scaleY; });
    },
    setUpperVisible(visible: boolean) {
      upperMeshes.forEach(m => { m.visible = visible; });
    },
    getCenterCoordinates() {
      const pb = poolCenter ? new THREE.Box3().setFromObject(poolCenter) : null;
      const poolPos: [number, number, number] = pb
        ? [(pb.min.x + pb.max.x) / 2, pb.max.y + 0.6, (pb.min.z + pb.max.z) / 2]
        : [5, 1, 0];

      return {
        stairs: [stairPos[0], stairPos[1] + 0.4, stairPos[2]],
        arandelas: [4.6, 2.2, -4.6],
        gourmet: [gourmetPos[0], gourmetPos[1] - 0.8, gourmetPos[2]],
        pool: poolPos
      };
    }
  };
}
