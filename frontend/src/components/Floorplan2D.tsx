import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, ZoomIn, ZoomOut, RotateCcw, Moon, Sun, Smartphone, Monitor } from 'lucide-react';
import type { Room } from '../types';
import { walls } from '../houseLayout';

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
  // Modo escuro é o padrão para estética premium em tablets
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
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

  // Helpers de conversão geométrica precisa
  // X da casa: 0 a 10 (largura)
  // Z da casa: 0 a 25 (comprimento)
  const isHoriz = orientation === 'horizontal';

  // Converte ponto (x, z) para SVG
  const toSvg = (x: number, z: number): [number, number] => {
    return isHoriz ? [25.0 - z, x] : [x, z];
  };

  // Converte um retângulo arquitetônico centrado em (cx, cz) com dimensões (wx, lz)
  const getCadRect = (cx: number, cz: number, wx: number, lz: number) => {
    if (isHoriz) {
      return {
        x: 25.0 - cz - lz / 2,
        y: cx - wx / 2,
        width: lz,
        height: wx,
      };
    } else {
      return {
        x: cx - wx / 2,
        y: cz - lz / 2,
        width: wx,
        height: lz,
      };
    }
  };

  const getCadLine = (x1: number, z1: number, x2: number, z2: number) => {
    const [p1x, p1y] = toSvg(x1, z1);
    const [p2x, p2y] = toSvg(x2, z2);
    return { x1: p1x, y1: p1y, x2: p2x, y2: p2y };
  };

  const getCadCircle = (cx: number, cz: number, r: number) => {
    const [px, py] = toSvg(cx, cz);
    return { cx: px, cy: py, r };
  };

  // Cores da prancha arquitetônica
  const isLight = theme === 'light';
  const wallPerimColor = isLight ? '#0F172A' : '#F8FAFC';
  const wallIntColor = isLight ? '#1E293B' : '#CBD5E1';
  const cadLineColor = isLight ? '#94A3B8' : '#64748B';
  const cadSubtleColor = isLight ? '#CBD5E1' : '#475569';
  const windowColor = isLight ? '#0284C7' : '#38BDF8';

  // ViewBox do SVG nativo
  const svgViewBox = isHoriz ? "0 0 25 10" : "0 0 10 25";

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
        PLANTA BAIXA VETORIAL NATIVA {orientation === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL'} • TOQUE EM UM CÔMODO
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
          {/* SVG NATIVO ARQUITETÔNICO - LINHAS 100% VETORIAIS E NÍTIDAS */}
          <svg
            className="floorplan-blueprint-svg"
            viewBox={svgViewBox}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          >
            <defs>
              {/* Grid arquitetônico de 1m com pontos */}
              <pattern id="cad-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.025" fill={isLight ? "#CBD5E1" : "#334155"} opacity="0.6" />
              </pattern>
            </defs>

            {/* Base da Prancha */}
            <rect
              x="0"
              y="0"
              width={isHoriz ? 25 : 10}
              height={isHoriz ? 10 : 25}
              fill={isLight ? "#FFFFFF" : "#0B0F17"}
            />
            <rect
              x="0"
              y="0"
              width={isHoriz ? 25 : 10}
              height={isHoriz ? 10 : 25}
              fill="url(#cad-grid)"
            />

            {/* CAMADA 1: Pisos dos Cômodos (com iluminação suave nativa) */}
            {rooms.map(room => {
              const x = room.center[0];
              const z = room.center[1];
              const w = room.size[0];
              const l = room.size[1];
              const rect = getCadRect(x, z, w, l);

              const isActive = !!roomActiveStates[room.id];
              const isSelected = selectedRoomId === room.id;
              const isHovered = hoveredRoomId === room.id;

              // Cor base do piso por tipo
              let baseFloor = isLight ? "#FFFFFF" : "#0F172A";
              if (room.type === 'bath') baseFloor = isLight ? "#F0F9FF" : "#082F49";
              else if (room.type === 'skylight') baseFloor = isLight ? "#F0FDF4" : "#052E16";
              else if (room.type === 'garage') baseFloor = isLight ? "#F8FAFC" : "#1E293B";
              else if (room.type === 'hall' || room.type === 'laundry' || room.type === 'closet') {
                baseFloor = isLight ? "#FAFAF9" : "#131C2E";
              }

              // Preenchimento com luz acesa
              let fill = baseFloor;
              if (isActive) {
                fill = isLight ? "#FEF3C7" : "rgba(245, 158, 11, 0.28)";
              } else if (isHovered) {
                fill = isLight ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.12)";
              }

              let stroke = isLight ? "#E2E8F0" : "#1E293B";
              let strokeWidth = 0.03;
              if (isSelected) {
                stroke = "#D97706";
                strokeWidth = 0.08;
              }

              return (
                <rect
                  key={`floor-${room.id}`}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  style={{ transition: 'fill 0.25s ease' }}
                />
              );
            })}

            {/* CAMADA 2: Mobília Arquitetônica Minimalista Vetorial */}
            <g className="cad-furniture-layer" strokeLinecap="round" strokeLinejoin="round">
              {/* Garagem: 2 Vagas e Silhuetas de Carro */}
              {(() => {
                const divider = getCadLine(5.0, 18.83, 5.0, 24.5);
                const car1 = getCadRect(2.5, 21.66, 1.9, 4.2);
                const car1Glass = getCadRect(2.5, 21.66, 1.5, 2.2);
                const car2 = getCadRect(7.5, 21.66, 1.9, 4.2);
                const car2Glass = getCadRect(7.5, 21.66, 1.5, 2.2);
                return (
                  <g opacity={isLight ? 0.75 : 0.5}>
                    <line {...divider} stroke={cadSubtleColor} strokeWidth={0.04} strokeDasharray="0.3 0.2" />
                    <rect {...car1} rx={0.3} fill="none" stroke={cadLineColor} strokeWidth={0.04} />
                    <rect {...car1Glass} rx={0.2} fill="none" stroke={cadSubtleColor} strokeWidth={0.03} />
                    <rect {...car2} rx={0.3} fill="none" stroke={cadLineColor} strokeWidth={0.04} />
                    <rect {...car2Glass} rx={0.2} fill="none" stroke={cadSubtleColor} strokeWidth={0.03} />
                  </g>
                );
              })()}

              {/* Cozinha: Ilha, Fogão Cooktop e Pia */}
              {(() => {
                const island = getCadRect(3.73, 16.01, 1.2, 2.4);
                const cooktop = getCadRect(3.73, 16.6, 0.75, 0.85);
                const sink = getCadRect(3.73, 15.4, 0.7, 0.8);
                return (
                  <g opacity={isLight ? 0.8 : 0.6}>
                    <rect {...island} rx={0.1} fill={isLight ? "#F8FAFC" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.04} />
                    <rect {...cooktop} rx={0.05} fill="none" stroke={cadLineColor} strokeWidth={0.03} />
                    <rect {...sink} rx={0.05} fill={isLight ? "#F0F9FF" : "#082F49"} stroke={cadLineColor} strokeWidth={0.03} />
                  </g>
                );
              })()}

              {/* Mesa de Jantar: Mesa com 6 Cadeiras */}
              {(() => {
                const table = getCadRect(7.74, 16.51, 1.4, 2.6);
                return (
                  <g opacity={isLight ? 0.85 : 0.6}>
                    <rect {...table} rx={0.2} fill={isLight ? "#FEF3C7" : "rgba(245, 158, 11, 0.15)"} stroke={isLight ? "#D97706" : "#F59E0B"} strokeWidth={0.04} />
                    {[-0.8, 0, 0.8].map((offsetZ, idx) => {
                      const chairTop = getCadRect(7.74 - 0.95, 16.51 + offsetZ, 0.36, 0.36);
                      const chairBottom = getCadRect(7.74 + 0.95, 16.51 + offsetZ, 0.36, 0.36);
                      return (
                        <React.Fragment key={`chair-${idx}`}>
                          <rect {...chairTop} rx={0.08} fill={isLight ? "#F1F5F9" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.03} />
                          <rect {...chairBottom} rx={0.08} fill={isLight ? "#F1F5F9" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.03} />
                        </React.Fragment>
                      );
                    })}
                  </g>
                );
              })()}

              {/* Sala de TV: Sofá e Linha de TV */}
              {(() => {
                const couch = getCadRect(7.74, 13.5, 2.8, 1.1);
                const tvLine = getCadLine(9.88, 12.0, 9.88, 13.8);
                return (
                  <g opacity={isLight ? 0.8 : 0.6}>
                    <rect {...couch} rx={0.2} fill={isLight ? "#F1F5F9" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.04} />
                    <line {...tvLine} stroke={isLight ? "#0F172A" : "#F8FAFC"} strokeWidth={0.08} />
                  </g>
                );
              })()}

              {/* Suíte Visitas: Cama de Casal e Criados-Mudos */}
              {(() => {
                const bed = getCadRect(3.73, 12.19, 1.6, 2.0);
                const pillow1 = getCadRect(3.35, 11.5, 0.5, 0.35);
                const pillow2 = getCadRect(4.11, 11.5, 0.5, 0.35);
                return (
                  <g opacity={isLight ? 0.8 : 0.6}>
                    <rect {...bed} rx={0.15} fill={isLight ? "#F8FAFC" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.04} />
                    <rect {...pillow1} rx={0.08} fill={isLight ? "#FFFFFF" : "#334155"} stroke={cadSubtleColor} strokeWidth={0.02} />
                    <rect {...pillow2} rx={0.08} fill={isLight ? "#FFFFFF" : "#334155"} stroke={cadSubtleColor} strokeWidth={0.02} />
                  </g>
                );
              })()}

              {/* Quarto Murilo: Cama e Mesa de Computador (Escritório Murilo) */}
              {(() => {
                const bed = getCadRect(4.4, 6.29, 1.5, 2.0);
                const pillow = getCadRect(4.4, 5.6, 0.6, 0.35);
                const desk = getCadRect(2.6, 5.5, 0.7, 1.5);
                const monitor = getCadRect(2.6, 5.5, 0.25, 0.7);
                return (
                  <g opacity={isLight ? 0.85 : 0.6}>
                    <rect {...bed} rx={0.15} fill={isLight ? "#F8FAFC" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.04} />
                    <rect {...pillow} rx={0.08} fill={isLight ? "#FFFFFF" : "#334155"} stroke={cadSubtleColor} strokeWidth={0.02} />
                    <rect {...desk} rx={0.05} fill={isLight ? "#FEF3C7" : "rgba(245, 158, 11, 0.15)"} stroke={isLight ? "#D97706" : "#F59E0B"} strokeWidth={0.04} />
                    <rect {...monitor} rx={0.03} fill={isLight ? "#1E293B" : "#F8FAFC"} stroke="none" />
                  </g>
                );
              })()}

              {/* Quarto Marina: Cama e Armário */}
              {(() => {
                const bed = getCadRect(8.27, 6.29, 1.6, 2.0);
                const pillow1 = getCadRect(7.9, 5.6, 0.5, 0.35);
                const pillow2 = getCadRect(8.64, 5.6, 0.5, 0.35);
                const wardrobe = getCadRect(7.0, 6.29, 0.6, 2.6);
                return (
                  <g opacity={isLight ? 0.8 : 0.6}>
                    <rect {...bed} rx={0.15} fill={isLight ? "#F8FAFC" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.04} />
                    <rect {...pillow1} rx={0.08} fill={isLight ? "#FFFFFF" : "#334155"} stroke={cadSubtleColor} strokeWidth={0.02} />
                    <rect {...pillow2} rx={0.08} fill={isLight ? "#FFFFFF" : "#334155"} stroke={cadSubtleColor} strokeWidth={0.02} />
                    <rect {...wardrobe} rx={0.05} fill={isLight ? "#F8FAFC" : "#1E293B"} stroke={cadSubtleColor} strokeWidth={0.03} />
                  </g>
                );
              })()}

              {/* Suíte Master: Cama King Size */}
              {(() => {
                const kingBed = getCadRect(8.0, 2.14, 2.2, 2.2);
                const pillow1 = getCadRect(7.5, 1.4, 0.65, 0.4);
                const pillow2 = getCadRect(8.5, 1.4, 0.65, 0.4);
                return (
                  <g opacity={isLight ? 0.85 : 0.6}>
                    <rect {...kingBed} rx={0.15} fill={isLight ? "#F8FAFC" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.04} />
                    <rect {...pillow1} rx={0.08} fill={isLight ? "#FFFFFF" : "#334155"} stroke={cadSubtleColor} strokeWidth={0.02} />
                    <rect {...pillow2} rx={0.08} fill={isLight ? "#FFFFFF" : "#334155"} stroke={cadSubtleColor} strokeWidth={0.02} />
                  </g>
                );
              })()}

              {/* Banheiros: Box de Vidro e Pias */}
              {(() => {
                const showerVisitas = getCadLine(1.98, 8.8, 5.48, 8.8);
                const drainVisitas = getCadCircle(3.73, 8.55, 0.08);
                const showerSocial = getCadLine(6.92, 10.7, 10.0, 10.7);
                const drainSocial = getCadCircle(8.46, 10.45, 0.08);
                const showerMaster = getCadLine(1.98, 1.0, 3.71, 1.0);
                const drainMaster = getCadCircle(2.84, 0.6, 0.08);
                return (
                  <g opacity={isLight ? 0.8 : 0.6}>
                    <line {...showerVisitas} stroke={windowColor} strokeWidth={0.04} />
                    <circle {...drainVisitas} fill="none" stroke={cadLineColor} strokeWidth={0.03} />
                    <line {...showerSocial} stroke={windowColor} strokeWidth={0.04} />
                    <circle {...drainSocial} fill="none" stroke={cadLineColor} strokeWidth={0.03} />
                    <line {...showerMaster} stroke={windowColor} strokeWidth={0.04} />
                    <circle {...drainMaster} fill="none" stroke={cadLineColor} strokeWidth={0.03} />
                  </g>
                );
              })()}

              {/* Claraboias: Motivo de Jardim */}
              {(() => {
                const planterEast = getCadRect(8.27, 9.25, 1.5, 1.1);
                const leaf1 = getCadCircle(8.0, 9.25, 0.16);
                const leaf2 = getCadCircle(8.5, 9.25, 0.16);
                const planterMaster = getCadRect(4.8, 1.49, 1.5, 1.1);
                const leaf3 = getCadCircle(4.8, 1.49, 0.22);
                return (
                  <g opacity={isLight ? 0.8 : 0.6}>
                    <rect {...planterEast} rx={0.15} fill={isLight ? "#DCFCE7" : "#064E3B"} stroke="#16A34A" strokeWidth={0.03} />
                    <circle {...leaf1} fill="#86EFAC" stroke="#15803D" strokeWidth={0.02} />
                    <circle {...leaf2} fill="#86EFAC" stroke="#15803D" strokeWidth={0.02} />
                    <rect {...planterMaster} rx={0.15} fill={isLight ? "#DCFCE7" : "#064E3B"} stroke="#16A34A" strokeWidth={0.03} />
                    <circle {...leaf3} fill="#86EFAC" stroke="#15803D" strokeWidth={0.02} />
                  </g>
                );
              })()}

              {/* Lavanderia e Closet */}
              {(() => {
                const washer = getCadRect(0.7, 12.5, 0.65, 0.65);
                const sinkLav = getCadRect(0.7, 13.4, 0.6, 0.65);
                const closetRack = getCadRect(0.4, 2.14, 0.6, 3.8);
                return (
                  <g opacity={isLight ? 0.8 : 0.6}>
                    <rect {...washer} rx={0.1} fill={isLight ? "#F1F5F9" : "#1E293B"} stroke={cadLineColor} strokeWidth={0.03} />
                    <circle {...getCadCircle(0.7, 12.5, 0.22)} fill="none" stroke={cadSubtleColor} strokeWidth={0.03} />
                    <rect {...sinkLav} rx={0.05} fill={isLight ? "#F0F9FF" : "#082F49"} stroke={cadLineColor} strokeWidth={0.03} />
                    <rect {...closetRack} fill={isLight ? "#F8FAFC" : "#1E293B"} stroke={cadSubtleColor} strokeWidth={0.03} />
                  </g>
                );
              })()}
            </g>

            {/* CAMADA 3: Esquadrias de Vidro (Janelas) nas Paredes Externas */}
            <g className="cad-windows-layer">
              {(() => {
                // Janelas Oeste (X=0)
                const winMurilo = getCadLine(0, 5.5, 0, 7.0);
                const winVisitas = getCadLine(0, 11.5, 0, 13.0);
                // Janelas Leste (X=10)
                const winMarina = getCadLine(10, 5.5, 10, 7.0);
                const winSala = getCadLine(10, 12.0, 10, 13.8);
                const winMaster = getCadLine(10, 1.0, 10, 3.0);

                return (
                  <g stroke={windowColor} strokeWidth={0.08} strokeLinecap="butt">
                    <line {...winMurilo} />
                    <line {...winVisitas} />
                    <line {...winMarina} />
                    <line {...winSala} />
                    <line {...winMaster} />
                  </g>
                );
              })()}
            </g>

            {/* CAMADA 4: Paredes Arquitetônicas Nativas (26 paredes vetorizadas) */}
            <g className="cad-walls-layer">
              {walls.map(wall => {
                const [x1, z1] = wall.start;
                const [x2, z2] = wall.end;
                const line = getCadLine(x1, z1, x2, z2);

                const isPerimeter = wall.id === 'west_wall' || wall.id === 'north_wall' || wall.id === 'east_wall' || wall.id === 'south_curb';
                const strokeColor = isPerimeter ? wallPerimColor : wallIntColor;
                const strokeThickness = isPerimeter ? 0.20 : 0.14;

                return (
                  <line
                    key={`wall-${wall.id}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={strokeColor}
                    strokeWidth={strokeThickness}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </g>
          </svg>

          {/* Camada Interativa HTML de Cômodos e Lâmpadas (Alinhamento Matemático 100%) */}
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

              if (isHoriz) {
                // Horizontal: 25m horizontal x 10m vertical
                const z2 = z + l / 2;
                left = ((25.0 - z2) / 25.0) * 100;
                width = (l / 25.0) * 100;
                top = ((x - w / 2) / 10.0) * 100;
                height = (w / 10.0) * 100;
              } else {
                // Vertical: 10m horizontal x 25m vertical
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
                  {/* Conteúdo interno do cômodo: Rótulo e Badge de Luz (Upright/Horizontal) */}
                  <div className={`room-content-wrap ${orientation}`}>
                    <span className="room-label-text">{room.name}</span>

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
