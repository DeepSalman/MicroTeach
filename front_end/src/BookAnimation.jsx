import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function ButterflyWing({ side, wingRef }) {
  const isRight = side === 'right';
  const sign = isRight ? 1 : -1;

  const wingShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.3 * sign, 0.6, 1.2 * sign, 1.0, 1.4 * sign, 0.7);
    shape.bezierCurveTo(1.5 * sign, 0.5, 1.3 * sign, 0.1, 1.0 * sign, -0.1);
    shape.bezierCurveTo(0.7 * sign, -0.3, 0.3 * sign, -0.4, 0.15 * sign, -0.25);
    shape.bezierCurveTo(0.05 * sign, -0.15, 0, -0.05, 0, 0);
    return shape;
  }, [sign]);

  const lowerWingShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.2 * sign, -0.3, 0.8 * sign, -0.7, 0.9 * sign, -0.5);
    shape.bezierCurveTo(0.95 * sign, -0.35, 0.7 * sign, -0.05, 0.4 * sign, 0.05);
    shape.bezierCurveTo(0.2 * sign, 0.1, 0.05 * sign, 0.05, 0, 0);
    return shape;
  }, [sign]);

  return (
    <group ref={wingRef}>
      {/* Upper wing */}
      <mesh rotation={[0.1, 0, 0]}>
        <shapeGeometry args={[wingShape]} />
        <meshStandardMaterial
          color="#ff2d78"
          side={THREE.DoubleSide}
          transparent
          opacity={0.95}
          roughness={0.2}
          metalness={0.3}
          emissive="#ff2d78"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Wing pattern spots */}
      <mesh position={[0.6 * sign, 0.35, 0.01]} rotation={[0.1, 0, 0]}>
        <circleGeometry args={[0.15, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.4}
        />
      </mesh>
      <mesh position={[0.35 * sign, 0.15, 0.01]} rotation={[0.1, 0, 0]}>
        <circleGeometry args={[0.07, 32]} />
        <meshStandardMaterial
          color="#ffe066"
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Lower wing */}
      <mesh position={[0, -0.05, 0]} rotation={[-0.15, 0, 0]}>
        <shapeGeometry args={[lowerWingShape]} />
        <meshStandardMaterial
          color="#ff6b1a"
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          roughness={0.2}
          metalness={0.3}
          emissive="#ff6b1a"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0.5 * sign, -0.3, 0.01]} rotation={[-0.15, 0, 0]}>
        <circleGeometry args={[0.1, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

function ButterflyBody() {
  return (
    <group>
      {/* Torso */}
      <mesh>
        <capsuleGeometry args={[0.04, 0.6, 8, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.03, 0.44, 0.04]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#e74c8b" emissive="#e74c8b" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.03, 0.44, 0.04]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#e74c8b" emissive="#e74c8b" emissiveIntensity={0.5} />
      </mesh>
      {/* Antennae */}
      <Antenna side="left" />
      <Antenna side="right" />
    </group>
  );
}

function Antenna({ side }) {
  const isLeft = side === 'left';
  const sign = isLeft ? -1 : 1;

  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.44, 0),
      new THREE.Vector3(sign * 0.15, 0.65, 0.05),
      new THREE.Vector3(sign * 0.2, 0.75, 0.02)
    );
  }, [sign]);

  const points = useMemo(() => curve.getPoints(20), [curve]);

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" linewidth={1} />
      </line>
      {/* Antenna tip */}
      <mesh position={[sign * 0.2, 0.75, 0.02]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff2d78" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Butterfly() {
  const groupRef = useRef();
  const leftWingRef = useRef();
  const rightWingRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (leftWingRef.current && rightWingRef.current) {
      const flapAngle = Math.sin(t * 6) * 1.2;
      leftWingRef.current.rotation.y = flapAngle;
      rightWingRef.current.rotation.y = -flapAngle;
    }

    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(t * 0.7) * 0.8;
      groupRef.current.position.y = Math.sin(t * 1.1) * 0.3;
      groupRef.current.position.z = Math.cos(t * 0.5) * 0.4;
      groupRef.current.rotation.y = Math.sin(t * 0.7) * 0.3;
      groupRef.current.rotation.z = Math.sin(t * 1.1) * 0.1;
    }
  });

  return (
    <group ref={groupRef} rotation={[0.3, 0, 0]}>
      <ButterflyBody />
      <ButterflyWing side="left" wingRef={leftWingRef} />
      <ButterflyWing side="right" wingRef={rightWingRef} />
    </group>
  );
}

function SparkleParticles({ count = 80 }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [data] = useState(() => {
    const rand = seededRandom(77);
    return Array.from({ length: count }, () => ({
      position: [(rand() - 0.5) * 8, (rand() - 0.5) * 6, (rand() - 0.5) * 4],
      speed: 0.3 + rand() * 0.7,
      offset: rand() * Math.PI * 2,
      scale: 0.01 + rand() * 0.03,
    }));
  });

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    data.forEach((p, i) => {
      const x = p.position[0] + Math.sin(t * p.speed + p.offset) * 0.5;
      const y = p.position[1] + Math.cos(t * p.speed * 0.7 + p.offset) * 0.4;
      const z = p.position[2] + Math.sin(t * 0.3 + p.offset) * 0.3;
      dummy.position.set(x, y, z);
      const s = p.scale * (0.5 + Math.sin(t * 3 + p.offset) * 0.5);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color="#f5c6d0"
        emissive="#e74c8b"
        emissiveIntensity={0.8}
        transparent
        opacity={0.6}
      />
    </instancedMesh>
  );
}

function Scene() {
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <Butterfly />
      <SparkleParticles count={80} />
    </Float>
  );
}

const BookAnimation = () => {
  return (
    <div className="book-animation-container">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} color="#ffffff" />
        <directionalLight position={[-3, 3, 2]} intensity={0.5} color="#f5c6d0" />
        <pointLight position={[0, 0, 4]} intensity={0.8} color="#e74c8b" distance={10} />
        <pointLight position={[2, 2, 0]} intensity={0.3} color="#a78bfa" distance={8} />

        <Scene />
      </Canvas>
    </div>
  );
};

export default BookAnimation;
