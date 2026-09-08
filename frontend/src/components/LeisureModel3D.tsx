import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { finishScene, type FinishSceneResult } from '../3d/leisureFinishes';
import { 
  Sun, Moon, Layers, Eye, EyeOff, ArrowLeft, RotateCw,
  Lightbulb, Droplets, Thermometer, Flame, Sparkles
} from 'lucide-react';

interface LeisureModel3DProps {
  devicesData: Record<string, Record<string, boolean | number>>;
  onToggleDeviceSwitch: (deviceId: string, code: string, currentState: boolean) => void;
  poolTemperature?: number;
  onNavigateHome?: () => void;
}

interface PinScreenPos {
  x: number;
  y: number;
  visible: boolean;
}

export const LeisureModel3D: React.FC<LeisureModel3DProps> = ({
  devicesData,
  onToggleDeviceSwitch,
  poolTemperature,
  onNavigateHome
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estados de controle da maquete
  const [isNight, setIsNight] = useState(true);
  const [showUpper, setShowUpper] = useState(false);
  const [wallsLowered, setWallsLowered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // Referências Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const finishesRef = useRef<FinishSceneResult | null>(null);
  const hemiRef = useRef<THREE.HemisphereLight | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);

  // Posições dos pins de tela
  const [pinPositions, setPinPositions] = useState<{
    stairs: PinScreenPos;
    arandelas: PinScreenPos;
    gourmet: PinScreenPos;
    pool: PinScreenPos;
  }>({
    stairs: { x: 0, y: 0, visible: false },
    arandelas: { x: 0, y: 0, visible: false },
    gourmet: { x: 0, y: 0, visible: false },
    pool: { x: 0, y: 0, visible: false }
  });

  // Extração dos status reais dos dispositivos Sonoff / Tuya
  const isStairOn = Boolean(devicesData['1000e4a34e']?.switch);
  const isArandelaOn = Boolean(devicesData['1000e4bd27']?.switch);
  const isGourmetOn = Boolean(devicesData['1000e4a34c']?.switch);
  const isPoolLightOn = Boolean(devicesData['1000e8f9b1']?.switch_2);
  const isWaterfallOn = Boolean(devicesData['1000e8f9b1']?.switch_1);
  const isHydroOn = Boolean(devicesData['1000e8f9b1']?.switch_3);
  const isPumpOn = Boolean(devicesData['1000e8f9b1']?.switch_4);

  // Inicialização Three.js
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c1017'); // Dark luxo
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 150);
    camera.position.set(0, 24, 23);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.maxDistance = 65;
    controls.minDistance = 6;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x887969, 0.5);
    scene.add(hemi);
    hemiRef.current = hemi;

    const sun = new THREE.DirectionalLight(0xffefd9, 0.4);
    sun.position.set(-10, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 0.1, far: 70 });
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);
    sunRef.current = sun;

    // Base de transformação (X, Y, Z) -> (Y, Z, X) em escala métrica
    const basis = new THREE.Matrix4().set(
      0, 0.1, 0, 0,
      0, 0, 0.1, 0,
      0.1, 0, 0, 0,
      0, 0, 0, 1
    );

    const upperIds = new Set([2, 27, 28, 30, 31, 32, 33, 34, 35]);
    const duplicates = new Set([37, 32]);
    const upperMeshes: THREE.Mesh[] = [];
    const wallMeshes: THREE.Mesh[] = [];
    const meshes: THREE.Mesh[] = [];

    const names: Record<number, string> = {
      0: 'Muro esquerdo', 1: 'Muro dos fundos', 3: 'Hidro', 5: 'Piscina',
      9: 'Ilha rebaixada', 10: 'Tampo da ilha', 11: 'Base da ilha',
      12: 'Coqueiro', 14: 'Geladeira', 20: 'Refrigerador', 25: 'Piso',
      26: 'Muro direito', 29: 'Portões / frente', 38: 'Cobertura banheiros',
      49: 'Deck', 53: 'Vaso', 54: 'Escada', 55: 'Porta banheiro',
      56: 'Banheiros', 57: 'Banheiros'
    };

    function material(old: THREE.Material, id: number): THREE.Material {
      const key = Number(old.name.replace('color_', ''));
      let color = key || 0xcccccc;
      if (key === 16448250) color = 0xbab7ad;
      if (key === 2829873) color = 0x252829;
      const result = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 });
      if (key === 2829873) { result.roughness = 0.35; result.metalness = 0.15; }
      if (id === 25) { result.color.set('#c9b18f'); }
      if (id === 3 || id === 5) { result.color.set('#128fc2'); result.roughness = 0.2; result.metalness = 0.12; }
      return result;
    }

    // Carregar o modelo OBJ
    const loader = new OBJLoader();
    loader.load(
      '/models/area-lazer.obj',
      (obj) => {
        for (const child of obj.children) {
          const match = /^(?:obj|group)_(\d+)(?:_|$)/.exec(child.name);
          const node = child as THREE.Mesh;
          if (!node.isMesh || !match) continue;
          const id = Number(match[1]);
          if (duplicates.has(id)) continue;

          const geo = node.geometry.clone();
          geo.applyMatrix4(basis);
          geo.computeVertexNormals();

          const mats = (Array.isArray(node.material) ? node.material : [node.material]).map(m => material(m, id));
          const mesh = new THREE.Mesh(geo, Array.isArray(node.material) ? mats : mats[0]);
          mesh.name = names[id] || 'Elemento ' + id;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.id = id;

          if (upperIds.has(id)) {
            upperMeshes.push(mesh);
            mesh.visible = false;
          }
          if ([0, 1, 26, 29].includes(id)) {
            wallMeshes.push(mesh);
          }

          scene.add(mesh);
          meshes.push(mesh);
        }

        // Piso base
        const floor = new THREE.Mesh(
          new THREE.BoxGeometry(26, 0.18, 11),
          new THREE.MeshStandardMaterial({ color: '#807566', roughness: 0.9 })
        );
        floor.position.y = -0.5;
        floor.receiveShadow = true;
        scene.add(floor);

        // Aplicar acabamentos realistas e iluminação
        const finishes = finishScene(scene, meshes, renderer, wallMeshes, upperMeshes);
        finishesRef.current = finishes;

        // Configuração inicial noturna
        finishes.setNight(true);
        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (error) => {
        console.error('Erro ao carregar modelo da Área de Lazer:', error);
        setIsLoading(false);
      }
    );

    // Loop de renderização com animação da água e atualização da posição dos pins
    let animId: number;
    const clock = new THREE.Clock();

    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      controls.update();
      const elapsedTime = clock.getElapsedTime();

      if (finishesRef.current) {
        finishesRef.current.update(elapsedTime);

        // Projetar coordenadas 3D no plano 2D da tela para os Pins
        const coords = finishesRef.current.getCenterCoordinates();
        const halfW = container.clientWidth / 2;
        const halfH = container.clientHeight / 2;

        const project = (pos: [number, number, number]): PinScreenPos => {
          const v = new THREE.Vector3(pos[0], pos[1], pos[2]);
          v.project(camera);
          const isBehind = v.z > 1;
          return {
            x: v.x * halfW + halfW,
            y: -(v.y * halfH) + halfH,
            visible: !isBehind && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1
          };
        };

        setPinPositions({
          stairs: project(coords.stairs),
          arandelas: project(coords.arandelas),
          gourmet: project(coords.gourmet),
          pool: project(coords.pool)
        });
      }

      renderer.render(scene, camera);
    };
    renderLoop();

    // Redimensionamento
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Sincronizar iluminação física com os interruptores Sonoff
  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setStairLight(isStairOn);
  }, [isStairOn]);

  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setArandelas(isArandelaOn);
  }, [isArandelaOn]);

  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setGourmetLight(isGourmetOn);
  }, [isGourmetOn]);

  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setPoolLight(isPoolLightOn);
  }, [isPoolLightOn]);

  // Alternar modo Noturno / Diurno
  const toggleNight = useCallback(() => {
    setIsNight(prev => {
      const next = !prev;
      if (sceneRef.current) sceneRef.current.background = new THREE.Color(next ? '#0c1017' : '#d8deda');
      if (hemiRef.current) hemiRef.current.intensity = next ? 0.45 : 1.8;
      if (sunRef.current) sunRef.current.intensity = next ? 0.35 : 2.6;
      if (finishesRef.current) finishesRef.current.setNight(next);
      return next;
    });
  }, []);

  // Alternar 2º Andar
  const toggleUpper = useCallback(() => {
    setShowUpper(prev => {
      const next = !prev;
      if (finishesRef.current) finishesRef.current.setUpperVisible(next);
      return next;
    });
  }, []);

  // Rebaixar muros
  const toggleWalls = useCallback(() => {
    setWallsLowered(prev => {
      const next = !prev;
      if (finishesRef.current) finishesRef.current.setWallScale(next ? 0.24 : 1.0);
      return next;
    });
  }, []);

  // Presets de Câmera
  const setViewPreset = useCallback((preset: 'geral' | 'piscina' | 'gourmet' | 'topo') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (preset) {
      case 'geral':
        camera.position.set(0, 24, 23);
        controls.target.set(0, 0, 0);
        break;
      case 'piscina':
        camera.position.set(13, 9, 8);
        controls.target.set(5, 0, 0);
        break;
      case 'gourmet':
        camera.position.set(-13, 8, 7);
        controls.target.set(-5, 1, 0);
        break;
      case 'topo':
        camera.position.set(0, 36, 0.001);
        controls.target.set(0, 0, 0);
        break;
    }
    controls.update();
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#0c1017]" ref={containerRef}>
      {/* Canvas 3D */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0c1017]/90 backdrop-blur-md text-white">
          <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
            <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 border-t-amber-400 animate-spin" />
            <Sparkles className="w-6 h-6 text-amber-400 absolute" />
          </div>
          <span className="text-base font-medium tracking-wide text-zinc-200">
            Carregando Maquete 3D da Área de Lazer...
          </span>
          <span className="text-xs text-amber-400/80 mt-1 font-mono">
            {loadProgress > 0 ? `${loadProgress}%` : 'Carregando acabamentos...'}
          </span>
        </div>
      )}

      {/* Pins Interativos de Automação Flutuantes */}
      {!isLoading && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Pin Escada */}
          {pinPositions.stairs.visible && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform duration-75 hover:scale-110 cursor-pointer"
              style={{ left: `${pinPositions.stairs.x}px`, top: `${pinPositions.stairs.y}px` }}
              onClick={() => onToggleDeviceSwitch('1000e4a34e', 'switch', isStairOn)}
            >
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all ${
                isStairOn
                  ? 'bg-amber-500/90 text-black border-amber-300 font-semibold shadow-amber-500/30 ring-2 ring-amber-400/50'
                  : 'bg-black/70 text-zinc-300 border-white/10 hover:border-white/30'
              }`}>
                <Lightbulb className={`w-3.5 h-3.5 ${isStairOn ? 'text-black' : 'text-zinc-400'}`} />
                <span className="text-xs tracking-tight">Escada</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isStairOn ? 'bg-black animate-pulse' : 'bg-zinc-500'}`} />
              </div>
            </div>
          )}

          {/* Pin Arandelas Piscina */}
          {pinPositions.arandelas.visible && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform duration-75 hover:scale-110 cursor-pointer"
              style={{ left: `${pinPositions.arandelas.x}px`, top: `${pinPositions.arandelas.y}px` }}
              onClick={() => onToggleDeviceSwitch('1000e4bd27', 'switch', isArandelaOn)}
            >
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all ${
                isArandelaOn
                  ? 'bg-amber-500/90 text-black border-amber-300 font-semibold shadow-amber-500/30 ring-2 ring-amber-400/50'
                  : 'bg-black/70 text-zinc-300 border-white/10 hover:border-white/30'
              }`}>
                <Flame className={`w-3.5 h-3.5 ${isArandelaOn ? 'text-black' : 'text-zinc-400'}`} />
                <span className="text-xs tracking-tight">Arandelas</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isArandelaOn ? 'bg-black animate-pulse' : 'bg-zinc-500'}`} />
              </div>
            </div>
          )}

          {/* Pin Iluminação Salão / Gourmet */}
          {pinPositions.gourmet.visible && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform duration-75 hover:scale-110 cursor-pointer"
              style={{ left: `${pinPositions.gourmet.x}px`, top: `${pinPositions.gourmet.y}px` }}
              onClick={() => onToggleDeviceSwitch('1000e4a34c', 'switch', isGourmetOn)}
            >
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all ${
                isGourmetOn
                  ? 'bg-amber-500/90 text-black border-amber-300 font-semibold shadow-amber-500/30 ring-2 ring-amber-400/50'
                  : 'bg-black/70 text-zinc-300 border-white/10 hover:border-white/30'
              }`}>
                <Lightbulb className={`w-3.5 h-3.5 ${isGourmetOn ? 'text-black' : 'text-zinc-400'}`} />
                <span className="text-xs tracking-tight">Salão / Gourmet</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isGourmetOn ? 'bg-black animate-pulse' : 'bg-zinc-500'}`} />
              </div>
            </div>
          )}

          {/* Pin Piscina & Deck */}
          {pinPositions.pool.visible && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform duration-75 hover:scale-105"
              style={{ left: `${pinPositions.pool.x}px`, top: `${pinPositions.pool.y}px` }}
            >
              <div className="flex flex-col items-center gap-1.5">
                {/* Badge de Temperatura da Água */}
                {poolTemperature !== undefined && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold backdrop-blur-md shadow-md">
                    <Thermometer className="w-3 h-3 text-cyan-400" />
                    <span>{poolTemperature}°C</span>
                  </div>
                )}

                {/* Controles Rápidos da Piscina */}
                <div className="flex items-center gap-1 bg-black/80 p-1 rounded-full border border-white/15 backdrop-blur-md shadow-xl">
                  {/* Luz da Piscina */}
                  <button
                    onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_2', isPoolLightOn)}
                    title="Luz da Piscina"
                    className={`p-1.5 rounded-full transition-all ${
                      isPoolLightOn ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/50' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                  </button>

                  {/* Cascata */}
                  <button
                    onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_1', isWaterfallOn)}
                    title="Cascata"
                    className={`p-1.5 rounded-full transition-all ${
                      isWaterfallOn ? 'bg-blue-500 text-white font-bold shadow-md shadow-blue-500/50' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Droplets className="w-3.5 h-3.5" />
                  </button>

                  {/* Hidro */}
                  <button
                    onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_3', isHydroOn)}
                    title="Hidromassagem"
                    className={`p-1.5 rounded-full transition-all ${
                      isHydroOn ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/50' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>

                  {/* Bomba Filtro */}
                  <button
                    onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_4', isPumpOn)}
                    title="Bomba Filtro"
                    className={`p-1.5 rounded-full transition-all ${
                      isPumpOn ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/50' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isPumpOn ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão de Retorno ao Início no canto superior esquerdo */}
      {onNavigateHome && (
        <button
          onClick={onNavigateHome}
          className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium shadow-xl"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Início</span>
        </button>
      )}

      {/* Barra Flutuante Superior de Presets de Câmera */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
        <button
          onClick={() => setViewPreset('geral')}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          Visão Geral
        </button>
        <button
          onClick={() => setViewPreset('piscina')}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          Piscina
        </button>
        <button
          onClick={() => setViewPreset('gourmet')}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          Gourmet
        </button>
        <button
          onClick={() => setViewPreset('topo')}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          Planta Topo
        </button>
      </div>

      {/* Barra Flutuante Inferior de Ferramentas de Inspeção */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/15 shadow-2xl">
        {/* Toggle 2º Andar */}
        <button
          onClick={toggleUpper}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            showUpper ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showUpper ? 'Ocultar 2º Andar' : 'Mostrar 2º Andar'}</span>
        </button>

        {/* Rebaixar Muros */}
        <button
          onClick={toggleWalls}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            wallsLowered ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {wallsLowered ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{wallsLowered ? 'Restaurar Muros' : 'Rebaixar Muros'}</span>
        </button>

        <div className="w-[1px] h-4 bg-white/10" />

        {/* Toggle Dia / Noite */}
        <button
          onClick={toggleNight}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            isNight ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}
        >
          {isNight ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          <span>{isNight ? 'Modo Noturno' : 'Modo Diurno'}</span>
        </button>
      </div>
    </div>
  );
};
