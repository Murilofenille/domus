import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface AutomationPinProps {
  position: [number, number, number];
  name: string;
  isOn: boolean;
  onToggle: () => void;
  isRealDevice?: boolean;
}

export const AutomationPin: React.FC<AutomationPinProps> = ({
  position,
  name,
  isOn,
  onToggle,
  isRealDevice = false
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Animação sutil de flutuação
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.04;
    }
  });

  const pinColor = isOn ? '#FFB703' : '#94A3B8';
  const emissiveColor = isOn ? '#FFAA00' : '#000000';
  const emissiveIntensity = isOn ? 1.4 : 0.0;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Luz realística emitida quando o switch está ligado */}
      {isOn && (
        <pointLight
          color="#FFE8B2"
          intensity={2.8}
          distance={5.5}
          decay={2}
          castShadow
          position={[0, -0.2, 0]}
        />
      )}

      {/* Halo de luz externo suave */}
      {isOn && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshBasicMaterial
            color="#FFC300"
            transparent
            opacity={0.35}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Esfera do Pin (Lâmpada) */}
      <mesh castShadow scale={hovered ? 1.15 : 1.0}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial
          color={pinColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>

      {/* Anel indicador estilizado */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.02, 16, 32]} />
        <meshStandardMaterial
          color={isOn ? '#FFFFFF' : '#CBD5E1'}
          emissive={isOn ? '#FFFFFF' : '#000000'}
          emissiveIntensity={isOn ? 0.8 : 0}
        />
      </mesh>

      {/* Cone ponteiro para baixo */}
      <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.10, 0.28, 20]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>

      {/* Tooltip HTML 3D Flutuante moderno */}
      {(hovered || isRealDevice) && (
        <Html
          position={[0, 0.38, 0]}
          center
          distanceFactor={18}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: isOn ? 'rgba(15, 23, 42, 0.92)' : 'rgba(30, 41, 59, 0.85)',
            color: '#FFFFFF',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '600',
            fontFamily: 'Inter, system-ui, sans-serif',
            whiteSpace: 'nowrap',
            boxShadow: isOn ? '0 0 15px rgba(255, 183, 3, 0.4)' : '0 2px 10px rgba(0,0,0,0.25)',
            border: isOn ? '1px solid #FFB703' : '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isOn ? '#FFB703' : '#64748B',
              boxShadow: isOn ? '0 0 8px #FFB703' : 'none'
            }} />
            <span>{name}</span>
            {isRealDevice && (
              <span style={{
                background: '#3B82F6',
                color: '#fff',
                fontSize: '8px',
                padding: '1px 5px',
                borderRadius: '6px',
                textTransform: 'uppercase'
              }}>TUYA REAL</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};
