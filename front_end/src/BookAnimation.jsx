import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

// Seeded random generator
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ==========================================
// 1. ORIGINAL BUTTERFLY DESIGN (PRESERVED)
// ==========================================
function OriginalButterflyWing({ side, wingRef }) {
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

function OriginalButterflyBody() {
  return (
    <group>
      <mesh>
        <capsuleGeometry args={[0.04, 0.6, 8, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[-0.03, 0.44, 0.04]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#e74c8b" emissive="#e74c8b" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.03, 0.44, 0.04]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#e74c8b" emissive="#e74c8b" emissiveIntensity={0.5} />
      </mesh>
      <OriginalAntenna side="left" />
      <OriginalAntenna side="right" />
    </group>
  );
}

function OriginalAntenna({ side }) {
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
      <mesh position={[sign * 0.2, 0.75, 0.02]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff2d78" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function OriginalButterfly() {
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
      <OriginalButterflyBody />
      <OriginalButterflyWing side="left" wingRef={leftWingRef} />
      <OriginalButterflyWing side="right" wingRef={rightWingRef} />
    </group>
  );
}

// ==============================================================
// 2. NEW ULTRA-VIBRANT BUTTERFLY (BIOLUMINESCENT SWALLOWTAIL / MORPHO)
// ==============================================================

// Theme color palettes for the vibrant design
const VIBRANT_THEMES = {
  morpho: {
    name: 'Celestial Morpho',
    primary: '#00f2fe',
    secondary: '#4facfe',
    accent: '#ec4899',
    edge: '#1e1b4b',
    vein: '#a5f3fc',
    gold: '#fbbf24',
    body: '#0f172a',
    glow: '#00e5ff',
    lightColor: '#00f0ff',
    lightIntensity: 1.2,
    sparkleColor: '#38bdf8'
  },
  aurora: {
    name: 'Golden Aurora',
    primary: '#f59e0b',
    secondary: '#fb7185',
    accent: '#8b5cf6',
    edge: '#450a0a',
    vein: '#fef08a',
    gold: '#fef08a',
    body: '#18181b',
    glow: '#f97316',
    lightColor: '#f59e0b',
    lightIntensity: 1.3,
    sparkleColor: '#fde047'
  }
};

// Generates procedural delicate wing vein geometry
function createVeinGeometry(points) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pts = curve.getPoints(24);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(p => [p.x, p.y, p.z]), 3));
  return geom;
}

// High-fidelity Vibrant Forewing with graceful arches, filigree veins, and luminous margin spots
function VibrantForewing({ side, wingRef, themeConfig }) {
  const isRight = side === 'right';
  const sign = isRight ? 1 : -1;

  // Outer Forewing silhouette
  const outerForewingShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    // Sweeping leading edge to apex
    s.bezierCurveTo(0.25 * sign, 0.7, 0.9 * sign, 1.45, 1.65 * sign, 1.2);
    // Outer scalloped apex curve
    s.bezierCurveTo(1.8 * sign, 1.05, 1.7 * sign, 0.65, 1.35 * sign, 0.2);
    // Inner trailing margin back to body
    s.bezierCurveTo(1.0 * sign, -0.15, 0.5 * sign, -0.25, 0.2 * sign, -0.15);
    s.bezierCurveTo(0.05 * sign, -0.08, 0, -0.02, 0, 0);
    return s;
  }, [sign]);

  // Inner Iridescent Core Membrane
  const innerCoreShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2 * sign, 0.55, 0.75 * sign, 1.15, 1.35 * sign, 0.95);
    s.bezierCurveTo(1.45 * sign, 0.82, 1.35 * sign, 0.48, 1.05 * sign, 0.12);
    s.bezierCurveTo(0.75 * sign, -0.12, 0.4 * sign, -0.18, 0.15 * sign, -0.1);
    s.bezierCurveTo(0.04 * sign, -0.05, 0, -0.01, 0, 0);
    return s;
  }, [sign]);

  // Delicate filigree vein branches
  const veins = useMemo(() => {
    return [
      // Subcostal / radial vein
      createVeinGeometry([
        new THREE.Vector3(0, 0.05, 0.01),
        new THREE.Vector3(0.5 * sign, 0.6, 0.01),
        new THREE.Vector3(1.1 * sign, 1.05, 0.01),
        new THREE.Vector3(1.55 * sign, 1.12, 0.01)
      ]),
      // Main medial vein
      createVeinGeometry([
        new THREE.Vector3(0, 0.02, 0.01),
        new THREE.Vector3(0.55 * sign, 0.45, 0.01),
        new THREE.Vector3(1.15 * sign, 0.7, 0.01),
        new THREE.Vector3(1.5 * sign, 0.8, 0.01)
      ]),
      // Branch 1
      createVeinGeometry([
        new THREE.Vector3(0.55 * sign, 0.45, 0.01),
        new THREE.Vector3(1.0 * sign, 0.4, 0.01),
        new THREE.Vector3(1.4 * sign, 0.5, 0.01)
      ]),
      // Branch 2
      createVeinGeometry([
        new THREE.Vector3(0.35 * sign, 0.25, 0.01),
        new THREE.Vector3(0.85 * sign, 0.15, 0.01),
        new THREE.Vector3(1.2 * sign, 0.18, 0.01)
      ])
    ];
  }, [sign]);

  // Pearlescent submarginal glowing jewels
  const marginDots = useMemo(() => {
    return [
      [1.68 * sign, 1.02, 0.055],
      [1.62 * sign, 0.82, 0.05],
      [1.5 * sign, 0.62, 0.045],
      [1.36 * sign, 0.42, 0.04],
      [1.18 * sign, 0.22, 0.035],
      [0.98 * sign, 0.05, 0.03]
    ];
  }, [sign]);

  return (
    <group ref={wingRef}>
      {/* 1. Outer Dark Velvety Border Membrane */}
      <mesh position={[0, 0, 0]}>
        <shapeGeometry args={[outerForewingShape]} />
        <meshStandardMaterial
          color={themeConfig.edge}
          side={THREE.DoubleSide}
          transparent
          opacity={0.96}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* 2. Inner Luminescent Chromatic Core */}
      <mesh position={[0, 0, 0.005]}>
        <shapeGeometry args={[innerCoreShape]} />
        <meshPhysicalMaterial
          color={themeConfig.primary}
          emissive={themeConfig.glow}
          emissiveIntensity={0.65}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          roughness={0.12}
          metalness={0.6}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* 3. Secondary Radiant Accent Highlight */}
      <mesh position={[0.45 * sign, 0.45, 0.008]} rotation={[0, 0, sign * 0.2]}>
        <circleGeometry args={[0.26, 32]} />
        <meshStandardMaterial
          color={themeConfig.accent}
          emissive={themeConfig.accent}
          emissiveIntensity={0.8}
          side={THREE.DoubleSide}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* 4. Golden / Electric Vein Lines */}
      {veins.map((geom, idx) => (
        <line key={idx} geometry={geom}>
          <lineBasicMaterial color={themeConfig.vein} linewidth={1.5} transparent opacity={0.7} />
        </line>
      ))}

      {/* 5. Submarginal Twinkle Gems */}
      {marginDots.map((dot, idx) => (
        <mesh key={idx} position={[dot[0], dot[1], 0.012]}>
          <circleGeometry args={[dot[2], 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={themeConfig.primary}
            emissiveIntensity={0.9}
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

// Scalloped Hindwing with graceful swallowtail extension and eye-spot (ocelli)
function VibrantHindwing({ side, wingRef, themeConfig }) {
  const isRight = side === 'right';
  const sign = isRight ? 1 : -1;

  // Hindwing shape with swallowtail streamer
  const hindwingShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    // Inner margin along abdomen
    s.bezierCurveTo(0.15 * sign, -0.3, 0.3 * sign, -0.65, 0.45 * sign, -0.9);
    // Lower scalloped edge leading to swallowtail extension
    s.bezierCurveTo(0.6 * sign, -1.0, 0.8 * sign, -1.15, 0.95 * sign, -1.05);
    // Swallowtail tail protrusion
    s.bezierCurveTo(1.1 * sign, -1.25, 1.15 * sign, -1.2, 1.05 * sign, -0.95);
    // Lateral scalloped margin back towards hinge
    s.bezierCurveTo(1.25 * sign, -0.7, 1.2 * sign, -0.35, 0.85 * sign, -0.05);
    s.bezierCurveTo(0.55 * sign, 0.12, 0.2 * sign, 0.1, 0, 0);
    return s;
  }, [sign]);

  const innerHindShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.05);
    s.bezierCurveTo(0.12 * sign, -0.28, 0.25 * sign, -0.55, 0.4 * sign, -0.78);
    s.bezierCurveTo(0.55 * sign, -0.85, 0.7 * sign, -0.95, 0.82 * sign, -0.85);
    s.bezierCurveTo(0.95 * sign, -0.65, 0.95 * sign, -0.35, 0.68 * sign, -0.1);
    s.bezierCurveTo(0.45 * sign, 0.05, 0.15 * sign, 0.04, 0, -0.05);
    return s;
  }, [sign]);

  return (
    <group ref={wingRef} position={[0, -0.08, -0.01]}>
      {/* 1. Base Hindwing Scalloped Plate */}
      <mesh>
        <shapeGeometry args={[hindwingShape]} />
        <meshStandardMaterial
          color={themeConfig.edge}
          side={THREE.DoubleSide}
          transparent
          opacity={0.96}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* 2. Inner Vivid Membrane */}
      <mesh position={[0, 0, 0.005]}>
        <shapeGeometry args={[innerHindShape]} />
        <meshPhysicalMaterial
          color={themeConfig.secondary}
          emissive={themeConfig.accent}
          emissiveIntensity={0.5}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          roughness={0.15}
          metalness={0.6}
        />
      </mesh>

      {/* 3. Jewel Eye-spot (Ocellus) */}
      <group position={[0.62 * sign, -0.52, 0.01]}>
        {/* Outer Ring */}
        <mesh>
          <circleGeometry args={[0.13, 24]} />
          <meshStandardMaterial color={themeConfig.edge} side={THREE.DoubleSide} />
        </mesh>
        {/* Gold Ring */}
        <mesh position={[0, 0, 0.002]}>
          <circleGeometry args={[0.09, 24]} />
          <meshStandardMaterial color={themeConfig.gold} emissive={themeConfig.gold} emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* Electric Pupil */}
        <mesh position={[0, 0, 0.004]}>
          <circleGeometry args={[0.05, 24]} />
          <meshStandardMaterial color={themeConfig.primary} emissive={themeConfig.glow} emissiveIntensity={1.0} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 4. Swallowtail Tip Jewel */}
      <mesh position={[1.08 * sign, -1.18, 0.01]}>
        <circleGeometry args={[0.04, 16]} />
        <meshStandardMaterial
          color={themeConfig.accent}
          emissive={themeConfig.accent}
          emissiveIntensity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// Anatomically sculpted butterfly body with segmented abdomen, compound eyes, and glowing antennae
function VibrantButterflyBody({ themeConfig }) {
  return (
    <group>
      {/* Abdomen segments */}
      <group position={[0, -0.22, 0]}>
        <mesh>
          <capsuleGeometry args={[0.038, 0.48, 8, 16]} />
          <meshStandardMaterial
            color={themeConfig.body}
            roughness={0.25}
            metalness={0.7}
            emissive={themeConfig.primary}
            emissiveIntensity={0.15}
          />
        </mesh>
        {/* Luminous abdominal segment rings */}
        {[-0.14, -0.06, 0.02, 0.1].map((y, idx) => (
          <mesh key={idx} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.039, 0.005, 8, 24]} />
            <meshStandardMaterial
              color={themeConfig.gold}
              emissive={themeConfig.gold}
              emissiveIntensity={0.8}
            />
          </mesh>
        ))}
      </group>

      {/* Thorax */}
      <mesh position={[0, 0.14, 0.01]}>
        <capsuleGeometry args={[0.052, 0.22, 8, 16]} />
        <meshStandardMaterial
          color={themeConfig.body}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.32, 0.02]}>
        <sphereGeometry args={[0.052, 16, 16]} />
        <meshStandardMaterial
          color={themeConfig.body}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Luminous Compound Eyes */}
      <mesh position={[-0.036, 0.34, 0.055]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshPhysicalMaterial
          color={themeConfig.primary}
          emissive={themeConfig.glow}
          emissiveIntensity={0.9}
          roughness={0.05}
          metalness={0.8}
        />
      </mesh>
      <mesh position={[0.036, 0.34, 0.055]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshPhysicalMaterial
          color={themeConfig.primary}
          emissive={themeConfig.glow}
          emissiveIntensity={0.9}
          roughness={0.05}
          metalness={0.8}
        />
      </mesh>

      {/* Curved Antennae with Glowing Bulb Tips */}
      <VibrantAntenna side="left" themeConfig={themeConfig} />
      <VibrantAntenna side="right" themeConfig={themeConfig} />
    </group>
  );
}

function VibrantAntenna({ side, themeConfig }) {
  const isLeft = side === 'left';
  const sign = isLeft ? -1 : 1;

  const curve = useMemo(() => {
    return new THREE.CubicBezierCurve3(
      new THREE.Vector3(sign * 0.015, 0.34, 0.03),
      new THREE.Vector3(sign * 0.12, 0.55, 0.1),
      new THREE.Vector3(sign * 0.22, 0.72, 0.08),
      new THREE.Vector3(sign * 0.28, 0.82, 0.02)
    );
  }, [sign]);

  const points = useMemo(() => curve.getPoints(24), [curve]);

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
        <lineBasicMaterial color={themeConfig.vein} linewidth={1.5} />
      </line>

      {/* Glowing teardrop antenna tip */}
      <mesh position={[sign * 0.28, 0.82, 0.02]}>
        <sphereGeometry args={[0.024, 12, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={themeConfig.primary}
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}

// Complete Vibrant Butterfly Assembly with realistic aerodynamic phase-lag flapping & gliding
function VibrantButterfly({ theme = 'morpho' }) {
  const themeConfig = VIBRANT_THEMES[theme] || VIBRANT_THEMES.morpho;

  const groupRef = useRef();
  const leftForewingRef = useRef();
  const rightForewingRef = useRef();
  const leftHindwingRef = useRef();
  const rightHindwingRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // 1. Aerodynamic Dual-Phase Flapping
    if (leftForewingRef.current && rightForewingRef.current) {
      // Forewing leads flap stroke
      const forewingFlap = Math.sin(t * 5.6) * 1.18;
      leftForewingRef.current.rotation.y = forewingFlap;
      rightForewingRef.current.rotation.y = -forewingFlap;

      // Dynamic wing dihedral flex on z-axis
      leftForewingRef.current.rotation.z = Math.cos(t * 5.6) * 0.14;
      rightForewingRef.current.rotation.z = -Math.cos(t * 5.6) * 0.14;
    }

    if (leftHindwingRef.current && rightHindwingRef.current) {
      // Hindwing flaps with natural 0.24 rad phase lag for realistic ripple motion
      const hindwingFlap = Math.sin(t * 5.6 - 0.24) * 1.05;
      leftHindwingRef.current.rotation.y = hindwingFlap;
      rightHindwingRef.current.rotation.y = -hindwingFlap;
      leftHindwingRef.current.rotation.z = Math.cos(t * 5.6 - 0.24) * 0.12;
      rightHindwingRef.current.rotation.z = -Math.cos(t * 5.6 - 0.24) * 0.12;
    }

    // 2. Spatial Figure-8 Flight Dynamics
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(t * 0.65) * 0.85;
      groupRef.current.position.y = Math.sin(t * 1.05) * 0.35;
      groupRef.current.position.z = Math.cos(t * 0.5) * 0.45;

      // Realistic banking into flight curves
      groupRef.current.rotation.y = Math.sin(t * 0.65) * 0.25;
      groupRef.current.rotation.z = Math.sin(t * 1.05) * 0.12;
      groupRef.current.rotation.x = 0.25 + Math.cos(t * 0.8) * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <VibrantButterflyBody themeConfig={themeConfig} />

      {/* Forewings */}
      <VibrantForewing side="left" wingRef={leftForewingRef} themeConfig={themeConfig} />
      <VibrantForewing side="right" wingRef={rightForewingRef} themeConfig={themeConfig} />

      {/* Hindwings */}
      <VibrantHindwing side="left" wingRef={leftHindwingRef} themeConfig={themeConfig} />
      <VibrantHindwing side="right" wingRef={rightHindwingRef} themeConfig={themeConfig} />

      {/* Attached Ambient Bioluminescent Aura */}
      <pointLight color={themeConfig.lightColor} intensity={themeConfig.lightIntensity} distance={5} decay={2} />
    </group>
  );
}

// Multi-color Stardust Particles
function VibrantSparkles({ count = 90, theme = 'morpho' }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const themeConfig = VIBRANT_THEMES[theme] || VIBRANT_THEMES.morpho;

  const [data] = useState(() => {
    const rand = seededRandom(88);
    return Array.from({ length: count }, () => ({
      position: [(rand() - 0.5) * 9, (rand() - 0.5) * 7, (rand() - 0.5) * 5],
      speed: 0.35 + rand() * 0.75,
      offset: rand() * Math.PI * 2,
      scale: 0.012 + rand() * 0.035,
    }));
  });

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    data.forEach((p, i) => {
      const x = p.position[0] + Math.sin(t * p.speed + p.offset) * 0.6;
      const y = p.position[1] + Math.cos(t * p.speed * 0.8 + p.offset) * 0.5;
      const z = p.position[2] + Math.sin(t * 0.35 + p.offset) * 0.4;
      dummy.position.set(x, y, z);
      const s = p.scale * (0.6 + Math.sin(t * 3.5 + p.offset) * 0.5);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={themeConfig.sparkleColor}
        emissive={themeConfig.glow}
        emissiveIntensity={1.2}
        transparent
        opacity={0.7}
      />
    </instancedMesh>
  );
}

// Floating Scene Wrapper
function Scene({ design }) {
  return (
    <Float speed={2.2} rotationIntensity={0.25} floatIntensity={0.6}>
      {design === 'classic' && <OriginalButterfly />}
      {design === 'morpho' && <VibrantButterfly theme="morpho" />}
      {design === 'aurora' && <VibrantButterfly theme="aurora" />}

      {design === 'classic' ? (
        <OriginalSparkleParticles count={80} />
      ) : (
        <VibrantSparkles count={90} theme={design} />
      )}
    </Float>
  );
}

function OriginalSparkleParticles({ count = 80 }) {
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

// Main Component with Live Interactive Selector
const BookAnimation = () => {
  // Read saved design or default to the new vibrant 'morpho'
  const [design, setDesign] = useState(() => {
    return localStorage.getItem('microteach_butterfly_design') || 'morpho';
  });

  const handleSelectDesign = (newDesign) => {
    setDesign(newDesign);
    localStorage.setItem('microteach_butterfly_design', newDesign);
  };

  return (
    <div className="book-animation-container">
      {/* Interactive Switcher Pill Bar for User Comparison */}
      <div className="butterfly-switcher-bar">
        <span className="switcher-label">Butterfly Design:</span>
        <div className="switcher-buttons">
          <button
            type="button"
            className={`switcher-btn ${design === 'classic' ? 'active' : ''}`}
            onClick={() => handleSelectDesign('classic')}
            title="The original pink & orange butterfly"
          >
            <span>🦋</span> Classic Coral
          </button>
          <button
            type="button"
            className={`switcher-btn ${design === 'morpho' ? 'active' : ''}`}
            onClick={() => handleSelectDesign('morpho')}
            title="New ultra-vibrant electric cyan & neon fuchsia Morpho"
          >
            <span>✨</span> Celestial Morpho
          </button>
          <button
            type="button"
            className={`switcher-btn ${design === 'aurora' ? 'active' : ''}`}
            onClick={() => handleSelectDesign('aurora')}
            title="New radiant imperial gold & sunset amber Swallowtail"
          >
            <span>🌟</span> Golden Aurora
          </button>
        </div>
      </div>

      <Canvas
        camera={{ position: [0, 0, 5], fov: 48 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 6, 5]} intensity={1.1} color="#ffffff" />
        <directionalLight position={[-4, 3, 2]} intensity={0.6} color="#c084fc" />
        <pointLight position={[0, 0, 4]} intensity={0.9} color="#38bdf8" distance={10} />
        <pointLight position={[2, -2, 2]} intensity={0.5} color="#ec4899" distance={8} />

        <Scene design={design} />
      </Canvas>
    </div>
  );
};

export default BookAnimation;
