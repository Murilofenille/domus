import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, ZoomIn, ZoomOut, RotateCcw, Moon, Sun } from 'lucide-react';
import type { Room } from '../types';

interface Floorplan2DProps {
  rooms: Room[];
  roomActiveStates: Record<string, boolean>;
  selectedRoomId?: string;
  onSelectRoom: (room: Room) => void;
}

export const Floorplan2D: React.FC<Floorplan2DProps> = ({
  rooms,
  roomActiveStates,
  selectedRoomId,
  onSelectRoom,
}) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchDistanceRef = useRef<number | null>(null);

  // Reset zoom e pan
  const handleReset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.75));
  };

  // Suporte a Mouse Drag para Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // apenas clique esquerdo
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Suporte a Wheel para Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setScale(prev => Math.min(Math.max(prev + zoomFactor, 0.75), 2.5));
  };

  // Suporte a Touch no Tablet (Pinch to Zoom e Drag Pan)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
      touchDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / touchDistanceRef.current;
      setScale(prev => Math.min(Math.max(prev * ratio, 0.75), 2.5));
      touchDistanceRef.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistanceRef.current = null;
  };

  // Prevenir zoom do navegador quando rolando na planta
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventDefaultWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    el.addEventListener('wheel', preventDefaultWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', preventDefaultWheel);
    };
  }, []);

  const imageSrc = theme === 'dark' ? '/planta_baixa_2d_dark.png' : '/planta_baixa_2d_light.png';

  return (
    <div
      ref={containerRef}
      className="floorplan-2d-viewport"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* HUD de Controles Flutuantes da Planta 2D */}
      <div className="floorplan-hud-controls" onClick={e => e.stopPropagation()}>
        <button
          className="hud-btn"
          onClick={handleZoomIn}
          title="Aumentar Zoom"
        >
          <ZoomIn size={18} />
        </button>
        <button
          className="hud-btn"
          onClick={handleZoomOut}
          title="Diminuir Zoom"
        >
          <ZoomOut size={18} />
        </button>
        <button
          className="hud-btn"
          onClick={handleReset}
          title="Ajustar à Tela"
        >
          <RotateCcw size={16} />
        </button>
        <div className="hud-divider" />
        <button
          className="hud-btn"
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? "Modo Planta Claro" : "Modo Planta Escuro"}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      {/* Indicador de Modo 2D e Dica de Navegação */}
      <div className="floorplan-info-badge">
        <span className="badge-dot" />
        PLANTA BAIXA 2D • TOQUE EM UM CÔMODO
      </div>

      {/* Prancha da Planta Baixa com Zoom e Pan Transform */}
      <div
        className="floorplan-canvas"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out'
        }}
      >
        {/* Imagem Arquitetônica Original da Planta */}
        <div className={`floorplan-blueprint-wrapper ${theme}`}>
          <img
            src={imageSrc}
            alt="Planta Baixa 2D da Casa"
            className="floorplan-blueprint-img"
            draggable={false}
          />

          {/* Camada Interativa de Cômodos e Lâmpadas */}
          <div className="floorplan-overlay">
            {rooms.map(room => {
              const x = room.center[0];
              const z = room.center[1];
              const w = room.size[0];
              const l = room.size[1];

              // Normalizado no grid 10m x 25m
              const left = ((x - w / 2) / 10.0) * 100;
              const top = ((z - l / 2) / 25.0) * 100;
              const width = (w / 10.0) * 100;
              const height = (l / 25.0) * 100;

              const isSelected = selectedRoomId === room.id;
              const isActive = !!roomActiveStates[room.id];
              const isHovered = hoveredRoomId === room.id;

              // Identificar se o cômodo tem lâmpada ou dispositivo Tuya
              const hasLamp = !!(room.deviceId || room.deviceKey || isActive || room.hasLight !== false);

              return (
                <div
                  key={room.id}
                  className={`floorplan-room-zone ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRoom(room);
                  }}
                  onMouseEnter={() => setHoveredRoomId(room.id)}
                  onMouseLeave={() => setHoveredRoomId(null)}
                  title={`${room.name} ${isActive ? '(Luz Ligada)' : ''}`}
                >
                  {/* Luz de preenchimento ambiente quando ligado */}
                  {isActive && <div className="room-ambient-glow" />}

                  {/* Badge de Lâmpada Minimalista */}
                  {hasLamp && (
                    <div
                      className={`floorplan-lamp-badge ${isActive ? 'lit' : 'off'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRoom(room);
                      }}
                      title={`${room.name}: ${isActive ? 'Luz Ligada' : 'Luz Desligada'}`}
                    >
                      <Lightbulb size={13} className="lamp-icon" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
