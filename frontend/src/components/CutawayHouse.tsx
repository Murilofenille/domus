import React from 'react';
import { rooms, walls, automationPins, WALL_HEIGHT, WALL_THICKNESS } from '../houseLayout';
import { AutomationPin } from './AutomationPin';
import type { Room, AutomationPinItem } from '../types';
import { Text } from '@react-three/drei';

interface CutawayHouseProps {
  lightStates: Record<string, boolean>;
  onToggleLight?: (pinId: string) => void;
  onSelectRoom?: (room: Room) => void;
  selectedRoomId?: string | null;
  roomActiveStates?: Record<string, boolean>;
  viewMode?: '3D' | '2D';
}

/**
 * Renderiza todas as paredes baixas arquitetônicas da casa.
 * 26 paredes extraídas da planta baixa simplificada.
 */
function ArchitecturalWalls() {
  const t = WALL_THICKNESS;
  const h = WALL_HEIGHT;

  return (
    <group>
      {walls.map((wall) => {
        const [x1, z1] = wall.start;
        const [x2, z2] = wall.end;
        const wallH = wall.height ?? h;
        const y = wallH / 2;

        const dx = x2 - x1;
        const dz = z2 - z1;

        // Parede horizontal (ao longo do eixo X)
        if (Math.abs(dz) < 0.001) {
          const len = Math.abs(dx);
          const cx = (x1 + x2) / 2;
          const cz = z1;
          return (
            <mesh key={wall.id} position={[cx, y, cz]} castShadow receiveShadow>
              <boxGeometry args={[len + t, wallH, t]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.35} metalness={0.05} />
            </mesh>
          );
        }

        // Parede vertical (ao longo do eixo Z)
        if (Math.abs(dx) < 0.001) {
          const len = Math.abs(dz);
          const cx = x1;
          const cz = (z1 + z2) / 2;
          return (
            <mesh key={wall.id} position={[cx, y, cz]} castShadow receiveShadow>
              <boxGeometry args={[t, wallH, len + t]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.35} metalness={0.05} />
            </mesh>
          );
        }

        // Parede diagonal
        const len = Math.sqrt(dx * dx + dz * dz);
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        const angle = Math.atan2(dz, dx);

        return (
          <mesh key={wall.id} position={[cx, y, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[len + t, wallH, t]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.35} metalness={0.05} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Mobília minimalista diorama arquitetônico
 */
function MinimalFurniture() {
  const woodMat = <meshStandardMaterial color="#E8E2D5" roughness={0.6} />;
  const fabricMat = <meshStandardMaterial color="#CBD5E1" roughness={0.8} />;
  const darkMat = <meshStandardMaterial color="#334155" roughness={0.4} />;
  const plantMat = <meshStandardMaterial color="#3B82F6" roughness={0.5} />;
  const leafMat = <meshStandardMaterial color="#15803D" roughness={0.6} />;
  const metalMat = <meshStandardMaterial color="#94A3B8" roughness={0.3} metalness={0.4} />;

  return (
    <group>
      {/* 1. MESA DE JANTAR (FRENTE DIREITA): Mesa com 6 Cadeiras */}
      <group position={[7.74, 0.38, 16.51]}>

        <mesh castShadow>
          <boxGeometry args={[1.6, 0.08, 2.6]} />
          {woodMat}
        </mesh>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.25, 0.38, 1.8]} />
          {darkMat}
        </mesh>
        {[-0.95, 0.95].map((sideX) =>
          [-0.8, 0, 0.8].map((sideZ, idx) => (
            <mesh key={`chair-${sideX}-${idx}`} position={[sideX, -0.05, sideZ]} castShadow>
              <boxGeometry args={[0.36, 0.36, 0.36]} />
              {fabricMat}
            </mesh>
          ))
        )}
      </group>

      {/* 3. SALA DE TV (MEIO DIREITA): Sofá + Rack TV na parede */}
      <group position={[7.74, 0.28, 13.0]}>
        <mesh position={[0, 0, 0.2]} castShadow>
          <boxGeometry args={[3.2, 0.36, 1.1]} />
          {fabricMat}
        </mesh>
        <mesh position={[0, 0.32, 0.65]} castShadow>
          <boxGeometry args={[3.2, 0.42, 0.24]} />
          {fabricMat}
        </mesh>
        {/* Painel TV na parede leste */}
        <mesh position={[2.1, 0.35, -0.2]} castShadow>
          <boxGeometry args={[0.15, 0.5, 2.0]} />
          {darkMat}
        </mesh>
      </group>

      {/* 4. COZINHA (FRENTE ESQUERDA): Ilha e Bancada */}
      <group position={[3.73, 0.45, 16.01]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[2.4, 0.72, 1.2]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.38, 0]} castShadow>
          <boxGeometry args={[2.5, 0.06, 1.3]} />
          {woodMat}
        </mesh>
        <mesh position={[-0.4, 0.42, 0]} castShadow>
          <boxGeometry args={[0.6, 0.02, 0.5]} />
          {darkMat}
        </mesh>
      </group>

      {/* 5. LAVANDERIA (PEQUENINA ESQUERDA): Máquinas de Lavar e Tanque */}
      <group position={[0.99, 0.45, 13.00]}>
        <mesh position={[0, 0, -0.4]} castShadow>
          <boxGeometry args={[0.65, 0.75, 0.65]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.3} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.4]} castShadow>
          <boxGeometry args={[0.65, 0.75, 0.65]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.3} metalness={0.1} />
        </mesh>
      </group>

      {/* 6. SUÍTE VISITAS (MEIO ESQUERDA): Cama de Casal */}
      <group position={[3.73, 0.22, 12.19]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.7, 0.36, 2.0]} />
          {woodMat}
        </mesh>
        <mesh position={[0, 0.18, -0.05]} castShadow>
          <boxGeometry args={[1.6, 0.14, 1.8]} />
          {fabricMat}
        </mesh>
        <mesh position={[-0.42, 0.28, -0.65]} castShadow>
          <boxGeometry args={[0.55, 0.1, 0.38]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
        </mesh>
        <mesh position={[0.42, 0.28, -0.65]} castShadow>
          <boxGeometry args={[0.55, 0.1, 0.38]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
        </mesh>
      </group>

      {/* 7. BANHEIRO VISITAS (MEIO ESQUERDA): Bancada */}
      <group position={[3.73, 0.35, 9.25]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.2, 0.55, 0.5]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.1} />
        </mesh>
      </group>

      {/* 8. QUARTO MURILO (TRÁS ESQUERDA): Cama + ESCRITÓRIO MURILO */}
      <group position={[4.25, 0.22, 7.20]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.6, 0.36, 1.9]} />
          {woodMat}
        </mesh>
        <mesh position={[0, 0.18, 0.05]} castShadow>
          <boxGeometry args={[1.5, 0.14, 1.7]} />
          {fabricMat}
        </mesh>
        <mesh position={[0, 0.28, -0.65]} castShadow>
          <boxGeometry args={[0.9, 0.1, 0.38]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
        </mesh>
      </group>
      {/* Mesa Escritório Murilo */}
      <group position={[2.65, 0.38, 5.35]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.15, 0.05, 0.65]} />
          {darkMat}
        </mesh>
        <mesh position={[-0.5, -0.19, 0]} castShadow>
          <boxGeometry args={[0.04, 0.38, 0.58]} />
          {metalMat}
        </mesh>
        <mesh position={[0.5, -0.19, 0]} castShadow>
          <boxGeometry args={[0.04, 0.38, 0.58]} />
          {metalMat}
        </mesh>
        {/* Monitores */}
        <mesh position={[-0.24, 0.16, -0.18]} castShadow>
          <boxGeometry args={[0.42, 0.26, 0.03]} />
          {darkMat}
        </mesh>
        <mesh position={[0.24, 0.16, -0.18]} castShadow>
          <boxGeometry args={[0.42, 0.26, 0.03]} />
          {darkMat}
        </mesh>
        {/* Cadeira */}
        <mesh position={[0, -0.05, 0.35]} castShadow>
          <boxGeometry args={[0.36, 0.36, 0.36]} />
          <meshStandardMaterial color="#1E293B" roughness={0.5} />
        </mesh>
      </group>

      {/* 9. BANHEIRO SOCIAL (MEIO DIREITA) */}
      <group position={[8.46, 0.35, 11.00]}>
        <mesh castShadow>
          <boxGeometry args={[1.1, 0.55, 0.5]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.1} />
        </mesh>
      </group>

      {/* 10. CLARABOIA DIREITA: Jardim de Inverno */}
      <group position={[8.27, 0.12, 9.25]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[2.6, 0.04, 1.2]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
        </mesh>
        {[-0.8, 0, 0.8].map((px, i) => (
          <group key={`plant-east-${i}`} position={[px, 0.15, 0]}>
            <mesh position={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.12, 0.25, 16]} />
              {plantMat}
            </mesh>
            <mesh position={[0, 0.22, 0]} castShadow>
              <sphereGeometry args={[0.22, 16, 16]} />
              {leafMat}
            </mesh>
          </group>
        ))}
      </group>

      {/* 11. QUARTO MARINA (TRÁS DIREITA): Cama */}
      <group position={[8.27, 0.22, 6.29]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.6, 0.36, 1.9]} />
          {woodMat}
        </mesh>
        <mesh position={[0, 0.18, 0.05]} castShadow>
          <boxGeometry args={[1.5, 0.14, 1.7]} />
          {fabricMat}
        </mesh>
        <mesh position={[0, 0.28, -0.65]} castShadow>
          <boxGeometry args={[0.9, 0.1, 0.38]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
        </mesh>
      </group>

      {/* 12. CLOSET (TRÁS ESQUERDA): Guarda-roupa com LED */}
      <group position={[0.99, 0.45, 2.0]}>
        <mesh position={[-0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.42, 0.85, 2.6]} />
          {woodMat}
        </mesh>
        <mesh position={[-0.2, 0.38, 0]}>
          <boxGeometry args={[0.04, 0.04, 2.4]} />
          <meshStandardMaterial color="#FFFBEB" emissive="#FDE047" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* 13. BANHEIRO MASTER (TRÁS MEIO-ESQUERDA) */}
      <group position={[2.84, 0.35, 1.49]}>
        <mesh castShadow>
          <boxGeometry args={[1.2, 0.55, 0.5]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.1} />
        </mesh>
      </group>

      {/* 14. CLARABOIA MASTER: Jardim */}
      <group position={[4.80, 0.12, 1.49]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[1.6, 0.04, 2.2]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
        </mesh>
        {[-0.4, 0.4].map((px, i) => (
          <group key={`plant-master-${i}`} position={[px, 0.18, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.18, 0.14, 0.3, 16]} />
              {plantMat}
            </mesh>
            <mesh position={[0, 0.3, 0]} castShadow>
              <sphereGeometry args={[0.28, 16, 16]} />
              {leafMat}
            </mesh>
          </group>
        ))}
      </group>

      {/* 15. SUÍTE MASTER (TRÁS DIREITA): Cama King Size */}
      <group position={[7.95, 0.24, 2.14]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[2.1, 0.38, 2.1]} />
          {woodMat}
        </mesh>
        <mesh position={[0, 0.19, 0.05]} castShadow>
          <boxGeometry args={[2.0, 0.14, 1.9]} />
          {fabricMat}
        </mesh>
        <mesh position={[0, 0.42, -0.98]} castShadow>
          <boxGeometry args={[2.3, 0.65, 0.12]} />
          {woodMat}
        </mesh>
        <mesh position={[-0.55, 0.3, -0.65]} castShadow>
          <boxGeometry args={[0.68, 0.1, 0.42]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
        </mesh>
        <mesh position={[0.55, 0.3, -0.65]} castShadow>
          <boxGeometry args={[0.68, 0.1, 0.42]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

export const CutawayHouse: React.FC<CutawayHouseProps> = ({
  lightStates,
  onSelectRoom,
  selectedRoomId,
  roomActiveStates,
  viewMode = '3D'
}) => {
  return (
    // Casa 10m x 25m centralizada na origem (0, 0, 0)
    <group position={[-5.0, 0, -12.5]}>
      {/* Terreno / Base Exterior */}
      <mesh position={[5.0, -0.05, 12.5]} receiveShadow>
        <boxGeometry args={[11.6, 0.08, 26.8]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
      </mesh>

      {/* 1. Pisos dos Cômodos com Labels de Identificação Arquitetônica */}
      {rooms.map((room) => {
        const [x, z] = room.center;
        const [width, length] = room.size;
        const isSelected = selectedRoomId === room.id;
        const fontSize = Math.min(0.36, width * 0.11, length * 0.18);

        return (
          <group key={room.id} position={[x, 0, z]}>
            <mesh
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectRoom) onSelectRoom(room);
              }}
            >
              <boxGeometry args={[width, 0.05, length]} />
              <meshStandardMaterial
                color={isSelected ? '#FDE047' : room.color}
                roughness={0.8}
                metalness={0.05}
              />
            </mesh>

            {/* Texto Gravado no Piso */}
            <Text
              position={[0, 0.035, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={fontSize}
              color="#334155"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.65}
              fontWeight="bold"
            >
              {room.name}
            </Text>
          </group>
        );
      })}

      {/* 2. Paredes Baixas Arquitetônicas Cortadas */}
      <ArchitecturalWalls />

      {/* 3. Mobília Interna Minimalista (oculta no Modo 2D Planta Pura) */}
      {viewMode !== '2D' && <MinimalFurniture />}

      {/* 4. Pins Interativos de Automação Tuya (Micro-Discos Minimalistas) */}
      {automationPins.map((pin: AutomationPinItem) => {
        const isRoomActive = !!roomActiveStates?.[pin.roomId] || !!lightStates[pin.id];
        const room = rooms.find(r => r.id === pin.roomId);

        return (
          <AutomationPin
            key={pin.id}
            position={pin.position}
            name={room?.name || pin.name}
            isOn={isRoomActive}
            onClick={() => {
              if (room && onSelectRoom) {
                onSelectRoom(room);
              }
            }}
          />
        );
      })}
    </group>
  );
};
