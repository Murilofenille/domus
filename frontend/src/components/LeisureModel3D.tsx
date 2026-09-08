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
  const isStairOn = Boolean(devicesData['1000e4a34e']?.switch ?? devicesData['1000e4a34e']?.switch_1);
  const isArandelaOn = Boolean(devicesData['1000e4bd27']?.switch ?? devicesData['1000e4bd27']?.switch_1);
  const isGourmetOn = Boolean(devicesData['1000e4a34c']?.switch ?? devicesData['1000e4a34c']?.switch_1);
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
    <div className="leisure-3d-wrapper" ref={containerRef}>
      {/* Canvas 3D */}
      <canvas ref={canvasRef} className="leisure-canvas" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="leisure-loader-overlay">
          <div className="leisure-loader-spinner">
            <div className="leisure-loader-ring" />
            <Sparkles size={24} style={{ position: 'absolute', color: '#F59E0B' }} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.02em', color: '#E2E8F0' }}>
            Carregando Maquete 3D da Área de Lazer...
          </span>
          <span style={{ fontSize: '12px', color: '#F59E0B', marginTop: '6px', fontFamily: 'monospace' }}>
            {loadProgress > 0 ? `${loadProgress}%` : 'Carregando acabamentos...'}
          </span>
        </div>
      )}

      {/* Pins Interativos de Automação Flutuantes */}
      {!isLoading && (
        <div className="leisure-pins-layer">
          {/* Pin Escada */}
          {pinPositions.stairs.visible && (
            <div
              className="leisure-pin"
              style={{ left: `${pinPositions.stairs.x}px`, top: `${pinPositions.stairs.y}px` }}
              onClick={() => onToggleDeviceSwitch('1000e4a34e', 'switch', isStairOn)}
            >
              <div className={`leisure-pin-badge ${isStairOn ? 'active' : ''}`}>
                <Lightbulb size={14} color={isStairOn ? '#000000' : '#94A3B8'} />
                <span>Escada</span>
                <span className={`leisure-pin-dot ${isStairOn ? 'active' : ''}`} />
              </div>
            </div>
          )}

          {/* Pin Arandelas Piscina */}
          {pinPositions.arandelas.visible && (
            <div
              className="leisure-pin"
              style={{ left: `${pinPositions.arandelas.x}px`, top: `${pinPositions.arandelas.y}px` }}
              onClick={() => onToggleDeviceSwitch('1000e4bd27', 'switch', isArandelaOn)}
            >
              <div className={`leisure-pin-badge ${isArandelaOn ? 'active' : ''}`}>
                <Flame size={14} color={isArandelaOn ? '#000000' : '#94A3B8'} />
                <span>Arandelas</span>
                <span className={`leisure-pin-dot ${isArandelaOn ? 'active' : ''}`} />
              </div>
            </div>
          )}

          {/* Pin Iluminação Salão / Gourmet */}
          {pinPositions.gourmet.visible && (
            <div
              className="leisure-pin"
              style={{ left: `${pinPositions.gourmet.x}px`, top: `${pinPositions.gourmet.y}px` }}
              onClick={() => onToggleDeviceSwitch('1000e4a34c', 'switch', isGourmetOn)}
            >
              <div className={`leisure-pin-badge ${isGourmetOn ? 'active' : ''}`}>
                <Lightbulb size={14} color={isGourmetOn ? '#000000' : '#94A3B8'} />
                <span>Salão / Gourmet</span>
                <span className={`leisure-pin-dot ${isGourmetOn ? 'active' : ''}`} />
              </div>
            </div>
          )}

          {/* Pin Piscina & Deck */}
          {pinPositions.pool.visible && (
            <div
              className="leisure-pool-widget"
              style={{ left: `${pinPositions.pool.x}px`, top: `${pinPositions.pool.y}px` }}
            >
              {poolTemperature !== undefined && (
                <div className="leisure-pool-temp">
                  <Thermometer size={13} color="#22D3EE" />
                  <span>{poolTemperature}°C</span>
                </div>
              )}

              <div className="leisure-pool-controls">
                {/* Luz da Piscina */}
                <button
                  type="button"
                  onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_2', isPoolLightOn)}
                  title="Luz da Piscina"
                  className={`leisure-pool-btn ${isPoolLightOn ? 'active-light' : ''}`}
                >
                  <Lightbulb size={15} />
                </button>

                {/* Cascata */}
                <button
                  type="button"
                  onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_1', isWaterfallOn)}
                  title="Cascata"
                  className={`leisure-pool-btn ${isWaterfallOn ? 'active-water' : ''}`}
                >
                  <Droplets size={15} />
                </button>

                {/* Hidro */}
                <button
                  type="button"
                  onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_3', isHydroOn)}
                  title="Hidromassagem"
                  className={`leisure-pool-btn ${isHydroOn ? 'active-hydro' : ''}`}
                >
                  <Sparkles size={15} />
                </button>

                {/* Bomba Filtro */}
                <button
                  type="button"
                  onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_4', isPumpOn)}
                  title="Bomba Filtro"
                  className={`leisure-pool-btn ${isPumpOn ? 'active-pump' : ''}`}
                >
                  <RotateCw size={14} className={isPumpOn ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão de Retorno ao Início no canto superior esquerdo */}
      {onNavigateHome && (
        <button
          type="button"
          onClick={onNavigateHome}
          className="leisure-back-btn"
          title="Voltar para a Tela Inicial"
        >
          <ArrowLeft size={14} />
          <span>Início</span>
        </button>
      )}

      {/* Barra Flutuante Superior de Presets de Câmera */}
      <div className="leisure-camera-bar">
        <button type="button" onClick={() => setViewPreset('geral')} className="leisure-cam-btn">
          Visão Geral
        </button>
        <button type="button" onClick={() => setViewPreset('piscina')} className="leisure-cam-btn">
          Piscina
        </button>
        <button type="button" onClick={() => setViewPreset('gourmet')} className="leisure-cam-btn">
          Gourmet
        </button>
        <button type="button" onClick={() => setViewPreset('topo')} className="leisure-cam-btn">
          Planta Topo
        </button>
      </div>

      {/* Barra Flutuante Inferior de Ferramentas de Inspeção */}
      <div className="leisure-tools-bar">
        {/* Toggle 2º Andar */}
        <button
          type="button"
          onClick={toggleUpper}
          className={`leisure-tool-btn ${showUpper ? 'active-amber' : ''}`}
        >
          <Layers size={14} />
          <span>{showUpper ? 'Ocultar 2º Andar' : 'Mostrar 2º Andar'}</span>
        </button>

        {/* Rebaixar Muros */}
        <button
          type="button"
          onClick={toggleWalls}
          className={`leisure-tool-btn ${wallsLowered ? 'active-blue' : ''}`}
        >
          {wallsLowered ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{wallsLowered ? 'Restaurar Muros' : 'Rebaixar Muros'}</span>
        </button>

        <div className="leisure-tool-sep" />

        {/* Toggle Dia / Noite */}
        <button
          type="button"
          onClick={toggleNight}
          className={`leisure-tool-btn ${isNight ? 'active-indigo' : 'active-amber'}`}
        >
          {isNight ? <Moon size={14} color="#818CF8" /> : <Sun size={14} color="#FBBF24" />}
          <span>{isNight ? 'Modo Noturno' : 'Modo Diurno'}</span>
        </button>
      </div>
    </div>
  );
};
