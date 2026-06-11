import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Box } from '@react-three/drei';
import * as THREE from 'three';

const strategies = [
  { label: 'QUANTUM AI',   color: '#00D4FF' },
  { label: 'XQ TRADE M8', color: '#4D9FFF' },
  { label: 'FOREX PRO',   color: '#9DC4FF' },
  { label: 'CRYPTO BOT',  color: '#00D4FF' },
  { label: 'OIL TRADER',  color: '#4D9FFF' },
  { label: 'ENSEMBLE',    color: '#9DC4FF' },
];

const facePositions: [number, number, number][] = [
  [0, 0, 1.51],   // front
  [0, 0, -1.51],  // back
  [0, 1.51, 0],   // top
  [0, -1.51, 0],  // bottom
  [1.51, 0, 0],   // right
  [-1.51, 0, 0],  // left
];

const faceRotations: [number, number, number][] = [
  [0, 0, 0],
  [0, Math.PI, 0],
  [-Math.PI / 2, 0, 0],
  [Math.PI / 2, 0, 0],
  [0, Math.PI / 2, 0],
  [0, -Math.PI / 2, 0],
];

function RotatingCube() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
      groupRef.current.rotation.x += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Glass cube body */}
      <Box args={[3, 3, 3]}>
        <meshStandardMaterial
          color="#00D4FF"
          transparent
          opacity={0.06}
          wireframe={false}
          side={THREE.DoubleSide}
        />
      </Box>

      {/* Wireframe overlay */}
      <Box args={[3.02, 3.02, 3.02]}>
        <meshBasicMaterial color="#00D4FF" wireframe transparent opacity={0.15} />
      </Box>

      {/* Strategy labels on each face */}
      {strategies.map((s, i) => (
        <group
          key={s.label}
          position={facePositions[i]}
          rotation={faceRotations[i]}
        >
          <Text
            fontSize={0.22}
            color={s.color}
            anchorX="center"
            anchorY="middle"
            font={undefined}
            letterSpacing={0.05}
          >
            {s.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

const StrategyCube = () => {
  return (
    <section id="strategies" className="relative bg-[#050508] py-24">
      <div className="max-w-6xl mx-auto px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="font-mono-custom text-xs text-cyan-400/60 uppercase tracking-widest mb-3">
            AI STRATEGIES
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Six algorithms.{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              One platform.
            </span>
          </h2>
        </div>

        {/* 3D Canvas */}
        <div className="relative w-full h-[500px] md:h-[600px]">
          {/* Glow backdrop */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
          </div>

          <Canvas
            camera={{ position: [0, 0, 6], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.4} />
            <pointLight position={[5, 5, 5]} intensity={1} color="#00D4FF" />
            <pointLight position={[-5, -5, -5]} intensity={0.5} color="#4D9FFF" />
            <RotatingCube />
          </Canvas>
        </div>

        {/* Strategy cards below cube */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-8">
          {strategies.map(s => (
            <div
              key={s.label}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center hover:border-cyan-500/30 transition-colors"
            >
              <div
                className="text-xs font-mono-custom font-semibold tracking-wide"
                style={{ color: s.color }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StrategyCube;
