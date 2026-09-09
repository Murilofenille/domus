import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { finishScene, type FinishSceneResult } from '../3d/leisureFinishes';
import { createWallCutaway } from '../3d/leisureCutaway';
import { 
  Sun, Moon, Eye, EyeOff, ArrowLeft, RotateCw,
  Lightbulb, Droplets, Thermometer, Flame, Sparkles
} from 'lucide-react';

interface LeisureModel3DProps {
  devicesData: Record<string, Record<string, boolean | number>>;
  onToggleDeviceSwitch: (deviceId: string, code: string, currentState: boolean) => void;
  poolTemperature?: number;
  onNavigateHome?: () => void;
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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Refs dos pins para atualização direta no DOM sem disparar re-render do React (60fps suave em tablets)
  const stairsPinRef = useRef<HTMLDivElement>(null);
  const arandelasPinRef = useRef<HTMLDivElement>(null);
  const gourmetPinRef = useRef<HTMLDivElement>(null);
  const poolPinRef = useRef<HTMLDivElement>(null);
  const updatePinsRef = useRef<(() => void) | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);

  // Extração dos status reais dos dispositivos Sonoff / Tuya
  const isStairOn = Boolean(devicesData['1000e4a34e']?.switch ?? devicesData['1000e4a34e']?.switch_1);
  const isArandelaOn = Boolean(devicesData['1000e4bd27']?.switch ?? devicesData['1000e4bd27']?.switch_1);
  const isGourmetOn = Boolean(devicesData['1000e4a34c']?.switch ?? devicesData['1000e4a34c']?.switch_1);
  const isFilterOn = Boolean(devicesData['1000e8f9b1']?.switch_1);
  const isHydroBackOn = Boolean(devicesData['1000e8f9b1']?.switch_2);
  const isHeaterOn = Boolean(devicesData['1000e8f9b1']?.switch_3);
  const isHydroFeetOn = Boolean(devicesData['1000e8f9b1']?.switch_4);

  // Inicialização Three.js
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;


    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Otimização crucial: a luz solar e a arquitetura são estáticas; renderiza o shadow map sob demanda
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = null; // O degradê CSS permanece fixo atrás da maquete.
    renderer.setClearColor(0x000000, 0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 150);
    camera.position.set(-23, 17, 14);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.maxDistance = 65;
    controls.minDistance = 6;
    controls.target.set(0, 0.5, 0);
    controlsRef.current = controls;

    // Luz ambiente noturna suave (céu azul marinho noturno / piso escuro)
    const hemi = new THREE.HemisphereLight(0x18243b, 0x080b12, 0.16);
    scene.add(hemi);
    hemiRef.current = hemi;

    // Luz direcional do luar suave
    const sun = new THREE.DirectionalLight(0x6080b0, 0.07);
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
    let cutaway: ReturnType<typeof createWallCutaway> | null = null;
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
          if (upperIds.has(id)) continue; // Exclui completamente todos os elementos do segundo andar

          const geo = node.geometry.clone();
          geo.applyMatrix4(basis);
          geo.computeVertexNormals();

          const mats = (Array.isArray(node.material) ? node.material : [node.material]).map(m => material(m, id));
          const mesh = new THREE.Mesh(geo, Array.isArray(node.material) ? mats : mats[0]);
          mesh.name = names[id] || 'Elemento ' + id;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.id = id;

          if ([0, 1, 26, 29].includes(id)) {
            wallMeshes.push(mesh);
          }

          scene.add(mesh);
          meshes.push(mesh);
        }

        // O piso do OBJ já fecha o ambiente: sem plataforma extra fora dos muros.

        // Aplicar acabamentos realistas e iluminação
        const finishes = finishScene(scene, meshes, renderer, wallMeshes, upperMeshes);
        finishesRef.current = finishes;
        cutaway = createWallCutaway(scene, meshes);

        // Configuração inicial noturna e sincronização das luzes reais
        finishes.setNight(true);
        finishes.setStairLight(isStairOn);
        finishes.setArandelas(isArandelaOn);
        finishes.setGourmetLight(isGourmetOn);
        finishes.setPoolLight(isHydroBackOn || isHydroFeetOn);
        setIsLoading(false);
        requestAnimationFrame(() => {
          if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
          if (updatePinsRef.current) updatePinsRef.current();
          if (requestRenderRef.current) requestRenderRef.current();
        });
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

    // Vetor reutilizável para projeções de tela (Zero Garbage Collection)
    const projVec = new THREE.Vector3();

    const updatePins = () => {
      if (!finishesRef.current || !container) return;
      const coords = finishesRef.current.getCenterCoordinates();
      const halfW = container.clientWidth / 2;
      const halfH = container.clientHeight / 2;

      const applyPos = (el: HTMLDivElement | null, pos: [number, number, number]) => {
        if (!el) return;
        projVec.set(pos[0], pos[1], pos[2]).project(camera);
        const isBehind = projVec.z > 1;
        const isVisible = !isBehind && projVec.x >= -1.05 && projVec.x <= 1.05 && projVec.y >= -1.05 && projVec.y <= 1.05;
        if (!isVisible) {
          if (el.style.display !== 'none') el.style.display = 'none';
        } else {
          const x = (projVec.x * halfW + halfW).toFixed(1);
          const y = (-(projVec.y * halfH) + halfH).toFixed(1);
          if (el.style.display !== 'block') el.style.display = 'block';
          el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        }
      };

      applyPos(stairsPinRef.current, coords.stairs);
      applyPos(arandelasPinRef.current, coords.arandelas);
      applyPos(gourmetPinRef.current, coords.gourmet);
      applyPos(poolPinRef.current, coords.pool);
    };
    updatePinsRef.current = updatePins;

    // Resolução Dinâmica Inteligente: 1.0 durante rotação/zoom para 60fps cravado na Mali-G72;
    // e restaura 2.0 (Retina máxima) quando a câmera para!
    const targetPixelRatio = Math.min(window.devicePixelRatio, 2.0);
    let isInteracting = false;
    let settleTimeout: number | null = null;

    const onStart = () => {
      isInteracting = true;
      if (settleTimeout !== null) {
        clearTimeout(settleTimeout);
        settleTimeout = null;
      }
      if (renderer.getPixelRatio() !== 1.0) {
        renderer.setPixelRatio(1.0);
      }
      requestRender();
    };

    const onEnd = () => {
      if (settleTimeout !== null) clearTimeout(settleTimeout);
      settleTimeout = window.setTimeout(() => {
        isInteracting = false;
        if (renderer.getPixelRatio() !== targetPixelRatio) {
          renderer.setPixelRatio(targetPixelRatio);
        }
        requestRender();
      }, 180);
    };

    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    controls.addEventListener('change', () => {
      requestRender();
      updatePins();
    });

    // Renderização inteligente sob demanda: 0% de uso de GPU em repouso
    let renderFrames = 15;
    const requestRender = () => {
      renderFrames = Math.max(renderFrames, 6);
    };
    requestRenderRef.current = requestRender;

    // Loop de renderização fluido sem sobrecarregar a GPU em repouso
    let animId: number;

    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      const isMoving = controls.update();
      if (isMoving) {
        renderFrames = 6;
        updatePins();
      } else if (!isInteracting && renderer.getPixelRatio() !== targetPixelRatio) {
        renderer.setPixelRatio(targetPixelRatio);
        renderFrames = 2;
      }

      if (renderFrames > 0) {
        renderFrames--;
        if (cutaway?.update(camera)) renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, camera);
      }
    };
    renderLoop();

    // Redimensionamento
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(isInteracting ? 1.0 : targetPixelRatio);
      renderer.setSize(w, h, false);
      updatePins();
      requestRender();
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      cancelAnimationFrame(animId);
      if (settleTimeout !== null) clearTimeout(settleTimeout);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.dispose();
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Sincronizar iluminação física com os interruptores Sonoff
  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setStairLight(isStairOn);
    if (requestRenderRef.current) requestRenderRef.current();
  }, [isStairOn]);

  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setArandelas(isArandelaOn);
    if (requestRenderRef.current) requestRenderRef.current();
  }, [isArandelaOn]);

  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setGourmetLight(isGourmetOn);
    if (requestRenderRef.current) requestRenderRef.current();
  }, [isGourmetOn]);

  useEffect(() => {
    if (!finishesRef.current) return;
    finishesRef.current.setPoolLight(isHydroBackOn || isHydroFeetOn);
    if (requestRenderRef.current) requestRenderRef.current();
  }, [isHydroBackOn, isHydroFeetOn]);

  // Alternar modo Noturno / Diurno com transição suave de iluminação
  const toggleNight = useCallback(() => {
    setIsNight(prev => {
      const next = !prev;
      if (sceneRef.current) {
        sceneRef.current.background = null;
      }
      if (hemiRef.current) {
        hemiRef.current.color.set(next ? 0x18243b : 0xffffff);
        hemiRef.current.groundColor.set(next ? 0x080b12 : 0x887969);
        hemiRef.current.intensity = next ? 0.16 : 1.8;
      }
      if (sunRef.current) {
        sunRef.current.color.set(next ? 0x6080b0 : 0xffefd9);
        sunRef.current.intensity = next ? 0.07 : 2.6;
      }
      if (finishesRef.current) finishesRef.current.setNight(next);
      if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
      if (requestRenderRef.current) requestRenderRef.current();
      return next;
    });
  }, []);

  // Rebaixar muros
  const toggleWalls = useCallback(() => {
    setWallsLowered(prev => {
      const next = !prev;
      if (finishesRef.current) finishesRef.current.setWallScale(next ? 0.24 : 1.0);
      if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
      if (requestRenderRef.current) requestRenderRef.current();
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
        camera.position.set(-23, 17, 14);
        controls.target.set(0, 0.5, 0);
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
    if (updatePinsRef.current) updatePinsRef.current();
    if (requestRenderRef.current) requestRenderRef.current();
  }, []);

  return (
    <div className="leisure-3d-wrapper" ref={containerRef} style={{
      background: isNight
        ? 'radial-gradient(ellipse at 50% 42%, #26313d 0%, #151d28 55%, #0c111a 100%)'
        : 'radial-gradient(ellipse at 50% 42%, #eef0eb 0%, #d5dcd9 58%, #b5c0c3 100%)'
    }}>
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

      {/* Pins Interativos de Automação Flutuantes (Diretos via Refs - Zero React Re-renders) */}
      {!isLoading && (
        <div className="leisure-pins-layer">
          {/* Pin Escada */}
          <div
            ref={stairsPinRef}
            className="leisure-pin"
            style={{ display: 'none', willChange: 'transform' }}
            onClick={() => onToggleDeviceSwitch('1000e4a34e', 'switch', isStairOn)}
          >
            <div className={`leisure-pin-badge ${isStairOn ? 'active' : ''}`}>
              <Lightbulb size={14} color={isStairOn ? '#000000' : '#94A3B8'} />
              <span>Escada</span>
              <span className={`leisure-pin-dot ${isStairOn ? 'active' : ''}`} />
            </div>
          </div>

          {/* Pin Arandelas Piscina */}
          <div
            ref={arandelasPinRef}
            className="leisure-pin"
            style={{ display: 'none', willChange: 'transform' }}
            onClick={() => onToggleDeviceSwitch('1000e4bd27', 'switch', isArandelaOn)}
          >
            <div className={`leisure-pin-badge ${isArandelaOn ? 'active' : ''}`}>
              <Flame size={14} color={isArandelaOn ? '#000000' : '#94A3B8'} />
              <span>Arandelas</span>
              <span className={`leisure-pin-dot ${isArandelaOn ? 'active' : ''}`} />
            </div>
          </div>

          {/* Pin Iluminação Salão / Gourmet */}
          <div
            ref={gourmetPinRef}
            className="leisure-pin"
            style={{ display: 'none', willChange: 'transform' }}
            onClick={() => onToggleDeviceSwitch('1000e4a34c', 'switch', isGourmetOn)}
          >
            <div className={`leisure-pin-badge ${isGourmetOn ? 'active' : ''}`}>
              <Lightbulb size={14} color={isGourmetOn ? '#000000' : '#94A3B8'} />
              <span>Salão / Gourmet</span>
              <span className={`leisure-pin-dot ${isGourmetOn ? 'active' : ''}`} />
            </div>
          </div>

          {/* Pin Piscina & Deck */}
          <div
            ref={poolPinRef}
            className="leisure-pool-widget"
            style={{ display: 'none', willChange: 'transform' }}
          >
            {poolTemperature !== undefined && (
              <div className="leisure-pool-temp">
                <Thermometer size={13} color="#22D3EE" />
                <span>{poolTemperature}°C</span>
              </div>
            )}

            <div className="leisure-pool-controls">
              {/* Canal 1: Filtro */}
              <button
                type="button"
                onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_1', isFilterOn)}
                title="Filtro (Canal 1)"
                className={`leisure-pool-btn ${isFilterOn ? 'active-pump' : ''}`}
              >
                <RotateCw size={14} className={isFilterOn ? 'animate-spin' : ''} />
              </button>

              {/* Canal 2: Hidro Costa */}
              <button
                type="button"
                onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_2', isHydroBackOn)}
                title="Hidro Costa (Canal 2)"
                className={`leisure-pool-btn ${isHydroBackOn ? 'active-hydro' : ''}`}
              >
                <Sparkles size={15} />
              </button>

              {/* Canal 3: Aquecedor */}
              <button
                type="button"
                onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_3', isHeaterOn)}
                title="Aquecedor (Canal 3)"
                className={`leisure-pool-btn ${isHeaterOn ? 'active-light' : ''}`}
              >
                <Flame size={15} />
              </button>

              {/* Canal 4: Hidro Pé */}
              <button
                type="button"
                onClick={() => onToggleDeviceSwitch('1000e8f9b1', 'switch_4', isHydroFeetOn)}
                title="Hidro Pé (Canal 4)"
                className={`leisure-pool-btn ${isHydroFeetOn ? 'active-water' : ''}`}
              >
                <Droplets size={15} />
              </button>
            </div>
          </div>
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
