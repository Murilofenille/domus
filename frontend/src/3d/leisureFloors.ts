import * as THREE from 'three';

// Textura procedural para porcelanato interno (Salão)
function createInsideTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b3aca0';
  ctx.fillRect(0, 0, 512, 512);

  // Placas de porcelanato 60x60
  const size = 128;
  for (let y = 0; y < 512; y += size) {
    for (let x = 0; x < 512; x += size) {
      ctx.fillStyle = '#c0b9ad';
      ctx.fillRect(x + 1.5, y + 1.5, size - 3, size - 3);
      ctx.fillStyle = (x + y) % 256 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
      ctx.fillRect(x + 1.5, y + 1.5, size - 3, size - 3);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Textura de pedra atérmica para o pátio externo da piscina
function createPatioTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#aba394';
  ctx.fillRect(0, 0, 512, 512);

  // Pedras retangulares atérmicas
  const rw = 128, rh = 64;
  for (let y = 0; y < 512; y += rh) {
    const shift = (y / rh) % 2 === 0 ? 0 : rw / 2;
    for (let x = -rw; x < 512 + rw; x += rw) {
      ctx.fillStyle = '#beb6a8';
      ctx.fillRect(x + shift + 1.5, y + 1.5, rw - 3, rh - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      ctx.fillRect(x + shift + 3, y + 3, rw - 6, rh - 6);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Textura de réguas de madeira nobre para o deck elevado da hidro
function createWoodDeckTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a2f18';
  ctx.fillRect(0, 0, 512, 512);

  // Réguas de madeira nobre
  const plankH = 32;
  for (let y = 0; y < 512; y += plankH) {
    const tone = 28 + Math.floor((y * 13) % 15);
    ctx.fillStyle = `hsl(28 42% ${tone}%)`;
    ctx.fillRect(0, y + 1, 512, plankH - 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, y + 3, 512, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(0, y + plankH - 3, 512, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function applyFloorFinishes(
  floor: THREE.Mesh,
  deck?: THREE.Mesh,
  divider: number = -2.4
) {
  const scene = floor.parent;
  if (!scene) return;

  const insideTileTex = createInsideTileTexture();
  const patioTex = createPatioTexture();
  const woodDeckTex = createWoodDeckTexture();

  const insideMaterial = new THREE.MeshStandardMaterial({
    map: insideTileTex,
    roughness: 0.40,
    metalness: 0.05
  });

  const patioMaterial = new THREE.MeshStandardMaterial({
    map: patioTex,
    roughness: 0.85,
    metalness: 0.02
  });

  const deckMaterial = new THREE.MeshStandardMaterial({
    map: woodDeckTex,
    roughness: 0.65,
    metalness: 0.05
  });

  // Ocultar a malha bruta original obj_25 que possuía mapeamento de UV defeituoso e Z-fighting com a piscina
  floor.visible = false;

  // 1. Piso do Salão / Gourmet (X de -12.5 até divider=-2.4, Z de -5.0 a 5.0)
  const salaoWidth = divider - (-12.5); // 10.1 m
  const salaoCenterX = -12.5 + salaoWidth / 2; // -7.45 m
  const salaoGeo = new THREE.BoxGeometry(salaoWidth, 0.10, 10.0);
  const salaoFloor = new THREE.Mesh(salaoGeo, insideMaterial);
  salaoFloor.name = 'Piso Salão Porcelanato';
  salaoFloor.position.set(salaoCenterX, 0.05, 0.0);
  salaoFloor.receiveShadow = true;
  scene.add(salaoFloor);

  // 2. Piso do Pátio da Piscina (X de divider=-2.4 até 12.5, Z de -5.0 a 5.0)
  // Altura ligeiramente inferior (0.098 vs 0.10) para Z-fighting ZERO absoluto com a bacia da piscina
  const patioWidth = 12.5 - divider; // 14.9 m
  const patioCenterX = divider + patioWidth / 2; // 5.05 m
  const patioGeo = new THREE.BoxGeometry(patioWidth, 0.098, 10.0);
  const patioFloor = new THREE.Mesh(patioGeo, patioMaterial);
  patioFloor.name = 'Piso Pátio Atérmico';
  patioFloor.position.set(patioCenterX, 0.049, 0.0);
  patioFloor.receiveShadow = true;
  scene.add(patioFloor);

  // 3. Deck Elevado de Madeira da Hidro (obj_49)
  if (deck) {
    deck.material = deckMaterial;
    deck.receiveShadow = true;
    deck.castShadow = true;
  }
}
