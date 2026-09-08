import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Lightbulb } from 'lucide-react';
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

  // Levitação inercial suave para aspecto futurista
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.position.y = position[1] + Math.sin(t * 1.6 + position[0]) * 0.03;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Luz realística projetada sobre o cômodo quando ligado */}
      {isOn && (
        <pointLight
          color="#FFE8B2"
          intensity={2.6}
          distance={5.5}
          decay={2}
          position={[0, -0.3, 0]}
        />
      )}

      {/* Brilho suave no piso/espaço do cômodo quando aceso */}
      {isOn && (
        <mesh position={[0, -0.15, 0]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshBasicMaterial
            color="#FFC300"
            transparent
            opacity={0.25}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Plaqueta de Vidro Flutuante Estilo Vision Pro / AR (Sem interruptor mini) */}
      <Html
        position={[0, 0, 0]}
        center
        distanceFactor={22}
        style={{ pointerEvents: 'auto', userSelect: 'none' }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`ar-room-badge ${isOn ? 'is-on' : 'is-off'}`}
          title={`${name}: Toque para ${isOn ? 'Desligar' : 'Ligar'}`}
        >
          <div className="ar-badge-icon-box">
            <Lightbulb size={13} className="ar-badge-icon" />
          </div>
          <span className="ar-badge-name">{name}</span>
          {isRealDevice && (
            <span className="ar-badge-tag">TUYA</span>
          )}
        </div>
      </Html>
    </group>
  );
};


