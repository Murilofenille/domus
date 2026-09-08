import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Lightbulb } from 'lucide-react';
import * as THREE from 'three';

interface AutomationPinProps {
  position: [number, number, number];
  name?: string;
  isOn: boolean;
  onClick: () => void;
}

export const AutomationPin: React.FC<AutomationPinProps> = ({
  position,
  name,
  isOn,
  onClick
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Levitação inercial suave para aspecto futurista
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.position.y = position[1] + Math.sin(t * 1.5 + position[0]) * 0.025;
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

      {/* Micro-Disco Circular Minimalista de Vidro (Apenas Ícone de Lâmpada) */}
      <Html
        position={[0, 0, 0]}
        center
        distanceFactor={22}
        style={{ pointerEvents: 'auto', userSelect: 'none' }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={`ar-lamp-orb ${isOn ? 'is-on' : 'is-off'}`}
          title={name ? `${name}: Toque para abrir controles` : 'Toque para abrir controles'}
        >
          <Lightbulb size={13} className="ar-lamp-icon" />
          {isOn && <span className="ar-lamp-glow-ring" />}
        </button>
      </Html>
    </group>
  );
};
