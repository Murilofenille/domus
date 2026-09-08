import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, ZoomIn, ZoomOut, RotateCcw, Moon, Sun, Smartphone, Monitor } from 'lucide-react';
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
  // Modo claro é o principal e padrão conforme solicitado
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  // Modo horizontal é o padrão para telas de tablet widescreen
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
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
    if (e.button !== 0) return;
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

  // Seleção de Imagem de Fundo (Horizontal vs Vertical)
  const imageSrc = orientation === 'horizontal'
    ? (theme === 'light' ? '/planta_baixa_horizontal_clean.png' : '/planta_baixa_horizontal_dark.png')
    : (theme === 'light' ? '/planta_baixa_2d_light.png' : '/planta_baixa_2d_dark.png');

  return (
    <div
      ref={containerRef}
      className={`floorplan-2d-viewport theme-${theme}`}
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
      {/* HUD de Controles Flutuantes da Planta 2D (Sem sombras pesadas) */}
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
        {/* Alternador Horizontal / Vertical */}
        <button
          className="hud-btn"
          onClick={() => {
            setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
            handleReset();
          }}
          title={orientation === 'horizontal' ? "Mudar para Modo Vertical" : "Mudar para Modo Horizontal (Tablet)"}
        >
          {orientation === 'horizontal' ? <Monitor size={17} /> : <Smartphone size={17} />}
        </button>
        {/* Alternador de Tema Claro / Escuro */}
        <button
          className="hud-btn"
          onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? "Modo Escuro" : "Modo Claro"}
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>

      {/* Indicador de Modo 2D e Dica de Navegação */}
      <div className="floorplan-info-badge">
        <span className="badge-dot" />
        PLANTA BAIXA 2D {orientation === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL'} • TOQUE EM UM CÔMODO
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
        <div className={`floorplan-blueprint-wrapper ${orientation} ${theme}`}>
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

              let left = 0;
              let top = 0;
              let width = 0;
              let height = 0;

              if (orientation === 'horizontal') {
                // Horizontal: Garagem à esquerda (Z=25 -> left=0), Suíte Master à direita (Z=0 -> left=100)
                // Eixo X da imagem = Comprimento da casa (25m)
                // Eixo Y da imagem = Largura da casa (10m)
                const z2 = z + l / 2;
                left = ((25.0 - z2) / 25.0) * 100;
                width = (l / 25.0) * 100;
                top = ((x - w / 2) / 10.0) * 100;
                height = (w / 10.0) * 100;
              } else {
                // Vertical: Garagem embaixo (Z=25), Suíte Master em cima (Z=0)
                left = ((x - w / 2) / 10.0) * 100;
                top = ((z - l / 2) / 25.0) * 100;
                width = (w / 10.0) * 100;
                height = (l / 25.0) * 100;
              }

              const isSelected = selectedRoomId === room.id;
              const isActive = !!roomActiveStates[room.id];
              const isHovered = hoveredRoomId === room.id;

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

                  {/* Conteúdo interno do cômodo: Rótulo e Badge de Luz (Upright/Horizontal) */}
                  <div className={`room-content-wrap ${orientation}`}>
                    {orientation === 'horizontal' && (
                      <span className="room-label-text">{room.name}</span>
                    )}

                    {hasLamp && (
                      <div
                        className={`floorplan-lamp-badge ${isActive ? 'lit' : 'off'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRoom(room);
                        }}
                        title={`${room.name}: ${isActive ? 'Luz Ligada' : 'Luz Desligada'}`}
                      >
                        <Lightbulb size={12} className="lamp-icon" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
