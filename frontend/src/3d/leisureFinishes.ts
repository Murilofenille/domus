import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { applyFloorFinishes } from './leisureFloors';

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
  scene.environmentIntensity = 0.04;
  room.dispose();
  pmrem.dispose();

  const bricks = texture('brick');
  const tiles = texture('tile');
  const paving = texture('paving');

  const brick = new THREE.MeshStandardMaterial({ map: bricks, bumpMap: bricks, bumpScale: 0.025, roughness: 0.91 });
  const stoneTexture = stoneMaps();
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture.map, bumpMap: stoneTexture.bump, bumpScale: 0.045, roughness: 0.89 });
  const pavingMat = new THREE.MeshStandardMaterial({ map: paving, bumpMap: paving, bumpScale: 0.007, roughness: 0.8 });
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

  const waterUniforms: { value: number }[] = [];
  const arandelaLights: THREE.PointLight[] = [];

  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    obj.name = name;
    obj.position.set(x, y, z);
    obj.castShadow = true;
    obj.receiveShadow = true;
    scene.add(obj);
    return obj;
  }

  function beam(a: THREE.Vector3, b: THREE.Vector3, width: number, mat: THREE.Material) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const obj = box('Borda em pedra', 0, 0, 0, width, width, delta.length() + width, mat);
    obj.position.copy(a).add(b).multiplyScalar(0.5);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize());
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

  const baseFloor = byId.get(25);
  const slab = byId.get(31);
  if (baseFloor) {
    const divider = slab ? new THREE.Box3().setFromObject(slab).max.x : -2.4;
    applyFloorFinishes(baseFloor, byId.get(49), divider);
  }

  // Superfície da água e revestimento da piscina
  let poolLight: THREE.PointLight | null = null;
  for (const id of [3, 5]) {
    const mesh = byId.get(id);
    if (!mesh) continue;
    const g = mesh.geometry;
    g.computeBoundingBox();
    const top = g.boundingBox ? g.boundingBox.max.y : 0;
    const p = g.attributes.position;
    const coords: number[] = [];
    const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; count: number }>();
    const key = (v: THREE.Vector3) => `${v.x.toFixed(4)},${v.z.toFixed(4)}`;

    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i);
      const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      if ([a, b, c].every(v => Math.abs(v.y - top) < 0.0001)) {
        for (const v of [a, b, c]) coords.push(v.x, top + 0.045, v.z);
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const k = [key(u), key(v)].sort().join('|');
          if (edges.has(k)) edges.get(k)!.count++;
          else edges.set(k, { a: u, b: v, count: 1 });
        }
      }
    }

    worldUV(g, 0.8);
    mesh.material = poolTile;

    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    wg.computeVertexNormals();

    const water = new THREE.MeshPhysicalMaterial({
      color: '#087da7',
      roughness: 0.17,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    water.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      waterUniforms.push(shader.uniforms.uTime);
      shader.vertexShader = 'varying vec3 vWater;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWater=position;');
      shader.fragmentShader = 'uniform float uTime; varying vec3 vWater;\n' + shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float a = sin(vWater.x * 17.0 + vWater.z * 9.0 + uTime * 0.65);
        float b = cos(vWater.z * 23.0 - vWater.x * 6.0 - uTime * 0.47);
        normal = normalize(normal + vec3(a * 0.07, b * 0.06, 0.0));`
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float ca = pow(max(0.0, sin(vWater.x * 13.0 + sin(vWater.z * 11.0 + uTime * 0.4)) + cos(vWater.z * 15.0 + sin(vWater.x * 7.0 - uTime * 0.3))) * 0.5, 5.0);
        diffuseColor.rgb += vec3(0.13, 0.28, 0.3) * ca;`
      );
    };

    const surface = new THREE.Mesh(wg, water);
    surface.name = id === 3 ? 'Eau — hidro' : 'Água — piscina';
    surface.renderOrder = 2;
    scene.add(surface);

    for (const edge of edges.values()) {
      if (edge.count === 1) {
        const a = edge.a.clone(), b = edge.b.clone();
        a.y = b.y = top + 0.13;
        beam(a, b, 0.18, coping);
      }
    }
  }

  // Luz subaquática da piscina (RGB / Cyan glow)
  const poolCenter = byId.get(5);
  if (poolCenter) {
    const pb = new THREE.Box3().setFromObject(poolCenter);
    poolLight = new THREE.PointLight('#00f0ff', 0, 10, 1.6);
    poolLight.position.set((pb.min.x + pb.max.x) / 2, pb.max.y - 0.2, (pb.min.z + pb.max.z) / 2);
    scene.add(poolLight);
  }

  // Arandelas ao longo dos muros do pátio
  for (const x of [1.5, 4.6, 7.7, 10.8]) {
    for (const z of [-4.83, 4.83]) {
      box('Arandela preta', x, 1.85, z, 0.17, 0.4, 0.13, metal);
      box('Difusor da arandela', x, 1.85, z + (z < 0 ? 0.075 : -0.075), 0.11, 0.3, 0.022, glowingArandelas);
      const lamp = new THREE.PointLight('#ff9d3b', 0, 6.0, 2.0);
      lamp.position.set(x, 1.8, z + (z < 0 ? 0.22 : -0.22));
      scene.add(lamp);
      arandelaLights.push(lamp);
    }
  }

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

  const glowingGourmetLamps = new THREE.MeshStandardMaterial({
    color: '#221a12',
    emissive: '#ffeed6',
    emissiveIntensity: 0.0,
    roughness: 0.2
  });

  if (gourmetMesh) {
    const gb = new THREE.Box3().setFromObject(gourmetMesh);
    const islandX = (gb.min.x + gb.max.x) / 2;
    const islandZ = (gb.min.z + gb.max.z) / 2;
    gourmetPos = [islandX, 2.4, 0.0];

    // 1. Pendentes Modernos sobre a Ilha Gourmet
    const pendenteXs = [islandX - 0.75, islandX + 0.75];
    for (const px of pendenteXs) {
      box('Cabo pendente gourmet', px, 2.38, islandZ, 0.012, 0.78, 0.012, metal);
      box('Cúpula pendente gourmet', px, 1.95, islandZ, 0.16, 0.20, 0.16, metal);
      box('Lente pendente gourmet', px, 1.84, islandZ, 0.13, 0.02, 0.13, glowingGourmetLamps);

      const spot = new THREE.SpotLight('#fff3dc', 0, 4.8, Math.PI / 3.5, 0.35, 1.8);
      spot.position.set(px, 1.85, islandZ);
      spot.target.position.set(px, 1.15, islandZ);
      scene.add(spot);
      scene.add(spot.target);
      gourmetLights.push({ light: spot, onIntensity: 14 });
    }

    // Luz difusa quente centrada na ilha e banquetas
    const islandPoint = new THREE.PointLight('#ffe6bf', 0, 7.5, 2.0);
    islandPoint.position.set(islandX, 2.30, islandZ);
    scene.add(islandPoint);
    gourmetLights.push({ light: islandPoint, onIntensity: 12 });
  }

  // 2. Spots Embutidos no Teto do Salão com Difusores Emissivos
  const ceilingSpots = [
    { x: -6.40, z: -4.00, label: 'Bancada pia / churrasqueira' },
    { x: -8.60, z: -4.00, label: 'Refrigeradores / despensa' },
    { x: -6.30, z: 1.80, label: 'Centro social salão' },
    { x: -5.60, z: 3.60, label: 'Lounge piscina' },
    { x: -9.20, z: 1.20, label: 'Fundo salão de estar' }
  ];

  for (const s of ceilingSpots) {
    box('Aro spot embutido', s.x, 2.76, s.z, 0.14, 0.02, 0.14, metal);
    box('Lente spot embutido', s.x, 2.75, s.z, 0.10, 0.015, 0.10, glowingGourmetLamps);
  }

  // 3. Luzes Pontuais Distribuídas para Cobertura Total e Equilibrada do Salão
  const kitchenLight = new THREE.PointLight('#ffe2b4', 0, 7.0, 1.9);
  kitchenLight.position.set(-6.50, 2.35, -4.00);
  scene.add(kitchenLight);
  gourmetLights.push({ light: kitchenLight, onIntensity: 14 });

  const loungeLight = new THREE.PointLight('#fff1d8', 0, 8.5, 1.7);
  loungeLight.position.set(-6.20, 2.35, 1.90);
  scene.add(loungeLight);
  gourmetLights.push({ light: loungeLight, onIntensity: 18 });

  const poolSideLounge = new THREE.PointLight('#fff3de', 0, 7.0, 1.9);
  poolSideLounge.position.set(-5.50, 2.35, 3.60);
  scene.add(poolSideLounge);
  gourmetLights.push({ light: poolSideLounge, onIntensity: 12 });

  const backHallLight = new THREE.PointLight('#ffe5be', 0, 7.5, 1.9);
  backHallLight.position.set(-9.20, 2.35, 0.50);
  scene.add(backHallLight);
  gourmetLights.push({ light: backHallLight, onIntensity: 12 });

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
    update(t: number) {
      waterUniforms.forEach(u => { u.value = t; });
    },
    setNight(on: boolean) {
      // Controla a intensidade da luz ambiente/reflexiva do céu noturno
      scene.environmentIntensity = on ? 0.04 : 1.0;
    },
    setArandelas(on: boolean) {
      arandelaLights.forEach(l => {
        l.intensity = on ? 18 : 0;
      });
      glowingArandelas.color.set(on ? '#ffdf9d' : '#221a12');
      glowingArandelas.emissiveIntensity = on ? 4.5 : 0.0;

      // Luz do coqueiro sincronizada com as arandelas
      if (coqueiroSpot) coqueiroSpot.intensity = on ? 24 : 0;
      if (coqueiroPoint) coqueiroPoint.intensity = on ? 12 : 0;
      glowingCoqueiroLens.color.set(on ? '#ffe0a0' : '#221a12');
      glowingCoqueiroLens.emissiveIntensity = on ? 5.0 : 0.0;
    },
    setStairLight(on: boolean) {
      if (stairLight) stairLight.intensity = on ? 18 : 0;
    },
    setGourmetLight(on: boolean) {
      gourmetLights.forEach(({ light, onIntensity }) => {
        light.intensity = on ? onIntensity : 0;
      });
      glowingGourmetLamps.color.set(on ? '#fff6e4' : '#221a12');
      glowingGourmetLamps.emissiveIntensity = on ? 4.0 : 0.0;
    },
    setPoolLight(on: boolean) {
      if (poolLight) poolLight.intensity = on ? 26 : 0;
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
