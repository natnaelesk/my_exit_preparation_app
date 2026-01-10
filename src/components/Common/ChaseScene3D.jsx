import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Simple 2D Student Character
function Student2D({ position, runningSpeed }) {
  const groupRef = useRef();
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    timeRef.current += delta * runningSpeed;
    if (groupRef.current) {
      // Running bounce
      groupRef.current.position.y = Math.sin(timeRef.current * 10) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Head */}
      <mesh position={[0, 0.3, 0]}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      
      {/* Body */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.2, 0.3, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      
      {/* Book in hand */}
      <mesh position={[-0.15, 0.15, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.12, 0.15, 0.01]} />
        <meshBasicMaterial color="#6366f1" opacity={0.8} transparent />
      </mesh>
      
      {/* Legs - running animation */}
      <mesh position={[-0.06, -0.05, 0]} rotation={[Math.sin(timeRef.current * 10) * 0.3, 0, 0]}>
        <boxGeometry args={[0.05, 0.2, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      <mesh position={[0.06, -0.05, 0]} rotation={[-Math.sin(timeRef.current * 10) * 0.3, 0, 0]}>
        <boxGeometry args={[0.05, 0.2, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      
      {/* Arms */}
      <mesh position={[-0.12, 0.1, 0]} rotation={[0, 0, Math.sin(timeRef.current * 10) * 0.4]}>
        <boxGeometry args={[0.04, 0.15, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      <mesh position={[0.12, 0.1, 0]} rotation={[0, 0, -Math.sin(timeRef.current * 10) * 0.4]}>
        <boxGeometry args={[0.04, 0.15, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
    </group>
  );
}

// Simple 2D Fat Guy Character
function FatGuy2D({ position, runningSpeed }) {
  const groupRef = useRef();
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    timeRef.current += delta * runningSpeed;
    if (groupRef.current) {
      // Running bounce
      groupRef.current.position.y = Math.sin(timeRef.current * 8) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Head */}
      <mesh position={[0, 0.35, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      
      {/* Body (fat) */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.35, 0.4, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      
      {/* Legs */}
      <mesh position={[-0.1, -0.1, 0]} rotation={[Math.sin(timeRef.current * 8) * 0.25, 0, 0]}>
        <boxGeometry args={[0.08, 0.25, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      <mesh position={[0.1, -0.1, 0]} rotation={[-Math.sin(timeRef.current * 8) * 0.25, 0, 0]}>
        <boxGeometry args={[0.08, 0.25, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      
      {/* Arms */}
      <mesh position={[-0.2, 0.15, 0]} rotation={[0, 0, Math.sin(timeRef.current * 8) * 0.5]}>
        <boxGeometry args={[0.06, 0.2, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      <mesh position={[0.2, 0.15, 0]} rotation={[0, 0, -Math.sin(timeRef.current * 8) * 0.5]}>
        <boxGeometry args={[0.06, 0.2, 0.01]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
    </group>
  );
}

// Simple 2D Paper
function Paper2D({ position, initialVelocity, delay }) {
  const meshRef = useRef();
  const timeRef = useRef(0);
  const velocityRef = useRef({ ...initialVelocity });

  useFrame((state, delta) => {
    timeRef.current += delta;
    if (meshRef.current && timeRef.current > delay) {
      velocityRef.current.y -= 9.8 * delta;
      meshRef.current.position.x += velocityRef.current.x * delta;
      meshRef.current.position.y += velocityRef.current.y * delta;
      meshRef.current.rotation.z += delta * 3;
      
      if (meshRef.current.position.y < -1 || meshRef.current.position.x < -8) {
        meshRef.current.position.x = position[0];
        meshRef.current.position.y = position[1];
        velocityRef.current = { ...initialVelocity };
        timeRef.current = 0;
      }
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.15, 0.2, 0.01]} />
      <meshBasicMaterial color="#6366f1" opacity={0.6} transparent />
    </mesh>
  );
}

// Main 2D Scene
export default function ChaseScene3D() {
  const studentPos = useRef([-2, 0, 0]);
  const fatGuyPos = useRef([-4, 0, 0]);
  const cameraPos = useRef(new THREE.Vector3(0, 0.5, 3));
  const cameraTarget = useRef(new THREE.Vector3(-3, 0.2, 0));

  const papers = [
    { id: 0, pos: [-1.5, 0.3, 0], vel: { x: -1.5, y: 1.5, z: 0 }, delay: 0 },
    { id: 1, pos: [-1.8, 0.4, 0], vel: { x: -1.2, y: 2, z: 0 }, delay: 0.2 },
    { id: 2, pos: [-2.1, 0.35, 0], vel: { x: -1.8, y: 1.8, z: 0 }, delay: 0.4 },
    { id: 3, pos: [-2.4, 0.4, 0], vel: { x: -1.3, y: 2.2, z: 0 }, delay: 0.6 },
  ];

  useFrame((state, delta) => {
    studentPos.current[0] += delta * 1.5;
    fatGuyPos.current[0] += delta * 1.2;
    
    if (studentPos.current[0] > 4) {
      studentPos.current[0] = -4;
      fatGuyPos.current[0] = -6;
    }
    
    const targetX = (studentPos.current[0] + fatGuyPos.current[0]) / 2;
    cameraTarget.current.lerp(new THREE.Vector3(targetX, 0.2, 0), 0.05);
    cameraPos.current.lerp(new THREE.Vector3(targetX, 0.5, 3), 0.05);
    
    state.camera.position.copy(cameraPos.current);
    state.camera.lookAt(cameraTarget.current);
  });

  return (
    <>
      {/* Simple flat lighting */}
      <ambientLight intensity={1} />
      
      {/* Ground line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <planeGeometry args={[20, 0.02]} />
        <meshBasicMaterial color="#6366f1" opacity={0.3} transparent />
      </mesh>
      
      {/* Student */}
      <Student2D position={studentPos.current} runningSpeed={10} />
      
      {/* Fat Guy */}
      <FatGuy2D position={fatGuyPos.current} runningSpeed={8} />
      
      {/* Papers */}
      {papers.map((paper) => (
        <Paper2D
          key={paper.id}
          position={paper.pos}
          initialVelocity={paper.vel}
          delay={paper.delay}
        />
      ))}
    </>
  );
}
