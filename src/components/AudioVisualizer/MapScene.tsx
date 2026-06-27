import { useFrame, extend, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, useMemo, useState, useLayoutEffect, useEffect } from 'react';
import { MapShaderMaterial } from './CustomShaderMaterial';
import { engine } from '../../lib/AudioEngine';
import { themes, type ThemeColors } from '../../lib/themes';
import { DEFAULT_GROUND_MOTION_SPEED, applyGroundEqBandValue, readGroundEqSettingsStorage, type StoredGroundEqSettings } from '../../lib/groundEqSettings';

extend({ MapShaderMaterial });

export function MapScene({
  themeColors = themes['ink-wash'],
  groundEqSettings = readGroundEqSettingsStorage(),
  rotationSpeed = themeColors.uRotationSpeed,
}: {
  themeColors?: ThemeColors;
  groundEqSettings?: StoredGroundEqSettings;
  rotationSpeed?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<any>(null);
  const { clock, camera } = useThree();
  const smoothedGroundAudioRef = useRef({
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    presence: 0,
    brilliance: 0,
    air: 0,
  });
  
  const gridSize = 160;
  const spacing = 1.05;
  const count = gridSize * gridSize;

  const controlsRef = useRef<any>(null);

  useEffect(() => {
    // Restore on mount
    const saved = localStorage.getItem('sonic_camera_state');
    if (saved) {
      try {
        const { position, target } = JSON.parse(saved);
        if (position) {
          camera.position.set(position.x, position.y, position.z);
        }
        // Use a timeout to ensure controls are fully initialized before applying target
        setTimeout(() => {
          if (target && controlsRef.current) {
            controlsRef.current.target.set(target.x, target.y, target.z);
            controlsRef.current.update();
          }
        }, 0);
      } catch (e) {
        console.error("Failed to restore camera state", e);
      }
    }

    const saveState = () => {
      if (controlsRef.current && camera) {
        localStorage.setItem('sonic_camera_state', JSON.stringify({
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: { x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z }
        }));
      }
    };

    window.addEventListener('beforeunload', saveState);

    return () => {
      saveState();
      window.removeEventListener('beforeunload', saveState);
    };
  }, [camera]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const tempMatrix = new THREE.Matrix4();
    const offset = (gridSize * spacing) / 2;

    let i = 0;
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const px = x * spacing - offset;
        const pz = z * spacing - offset;
        tempMatrix.makeTranslation(px, 0.5, pz);
        meshRef.current.setMatrixAt(i, tempMatrix);
        i++;
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [gridSize, spacing]);

  // Ripples logic
  // We keep a ring buffer of 10 ripples
  const ripplesRef = useRef(new Array(10).fill(null).map(() => ({
    pos: new THREE.Vector2(),
    time: -100,
    strength: 0,
    isActive: 0
  })));
  const rippleIndex = useRef(0);

  const addRipple = (x: number, y: number, strength: number, isWhite: boolean = false) => {
    const idx = rippleIndex.current;
    ripplesRef.current[idx] = {
      pos: new THREE.Vector2(x, y),
      time: clock.getElapsedTime(),
      strength,
      isActive: 1,
      rippleType: isWhite ? 1 : 0
    } as any;
    rippleIndex.current = (idx + 1) % 10;
  };

  const fogRef = useRef<THREE.Fog>(null);
  
  // Meteors logic
  const MAX_METEORS = 20;
  const meteorMeshRef = useRef<THREE.InstancedMesh>(null);
  const meteorMatRef = useRef<THREE.MeshBasicMaterial>(null);
  
  // Particles for meteor trails
  const MAX_PARTICLES = 200;
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const particlesRef = useRef(new Array(MAX_PARTICLES).fill(null).map(() => ({
    active: false,
    x: 0, y: -1000, z: 0,
    vx: 0, vy: 0, vz: 0,
    life: 0, maxLife: 1, scale: 1
  })));
  const particleIndex = useRef(0);
  const spawnParticle = (x: number, y: number, z: number, speedMultiplier: number) => {
     const idx = particleIndex.current;
     const p = particlesRef.current[idx];
     p.active = true;
     p.x = x + (Math.random() - 0.5) * 1.5;
     p.y = y + (Math.random() - 0.5) * 1.5;
     p.z = z + (Math.random() - 0.5) * 1.5;
     p.vx = (Math.random() - 0.5) * 2.0;
     p.vy = Math.random() * 2.0 + speedMultiplier * 10.0;
     p.vz = (Math.random() - 0.5) * 2.0;
     p.life = 0;
     p.maxLife = 0.5 + Math.random() * 0.5;
     p.scale = Math.random() * 0.6 + 0.2;
     particleIndex.current = (idx + 1) % MAX_PARTICLES;
  };
  
  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyPosition = useMemo(() => new THREE.Vector3(), []);
  const dummyRotation = useMemo(() => new THREE.Quaternion(), []);
  const dummyScale = useMemo(() => new THREE.Vector3(), []);
  
  const meteorsRef = useRef(new Array(MAX_METEORS).fill(null).map(() => ({
    active: false,
    x: 0,
    y: -1000,
    z: 0,
    speed: 0,
    strength: 0,
  })));
  const meteorIndex = useRef(0);
  const lastMeteorSpawnTime = useRef(-Infinity);

  const addMeteor = (strength: number) => {
     const now = clock.getElapsedTime();
     const cooldownSeconds = engine.meteorTrigger.cooldown / 60;
     if (now - lastMeteorSpawnTime.current < cooldownSeconds) return;
     lastMeteorSpawnTime.current = now;

     const idx = meteorIndex.current;
     const angle = Math.random() * Math.PI * 2;
     const dist = Math.random() * 25;
     
     const m = meteorsRef.current[idx];
     m.active = true;
     m.x = Math.cos(angle) * dist;
     m.z = Math.sin(angle) * dist;
     m.y = 30 + Math.random() * 10;
     m.speed = 1.0 + Math.random() * 0.5 + (strength * 1.5);
     m.strength = strength;
     
     meteorIndex.current = (idx + 1) % MAX_METEORS;
  };
  
  // Wire up audio engine beat detection
  useEffect(() => {
    engine.onFreqTrigger = (strength, mode, action) => {
       if (action === 'Meteor') {
          addMeteor(strength);
       } else {
          const angle = Math.random() * Math.PI * 2;
          if (mode === 'Kick') {
             const dist = Math.random() * 25; // Random position, can be near center or further out
             const rx = Math.cos(angle) * dist;
             const rz = Math.sin(angle) * dist;
             addRipple(rx, rz, Math.min(strength * 3.0, 4.0));
          } 
          else {
             const dist = 10 + Math.random() * 25; 
             const rx = Math.cos(angle) * dist;
             const rz = Math.sin(angle) * dist;
             addRipple(rx, rz, Math.min(strength * 3.0, 3.0));
          }
       }
    };
  }, [themeColors]);

  useFrame((state, delta) => {
    if (!materialRef.current) return;
    const mat = materialRef.current;
    const data = engine.getAudioData();
    const t = themeColors;
    const eqBands = groundEqSettings.bands;
    const motionSpeed = Math.max(0, Math.min(100, groundEqSettings.motionSpeed ?? DEFAULT_GROUND_MOTION_SPEED));
    const responseRate = THREE.MathUtils.lerp(2.2, 60, motionSpeed / 100);
    const responseBlend = 1 - Math.exp(-responseRate * delta);
    const targetEqSubBass = applyGroundEqBandValue(data.subBass, eqBands, 'subBass');
    const targetEqBass = applyGroundEqBandValue(data.bass, eqBands, 'bass');
    const targetEqLowMid = applyGroundEqBandValue(data.lowMid, eqBands, 'lowMid');
    const targetEqMid = applyGroundEqBandValue(data.mid, eqBands, 'mid');
    const targetEqHighMid = applyGroundEqBandValue(data.highMid, eqBands, 'highMid');
    const targetEqPresence = applyGroundEqBandValue(data.presence, eqBands, 'presence');
    const targetEqBrilliance = applyGroundEqBandValue(data.brilliance, eqBands, 'brilliance');
    const targetEqAir = applyGroundEqBandValue(data.air, eqBands, 'air');
    const smoothed = smoothedGroundAudioRef.current;
    smoothed.subBass = THREE.MathUtils.lerp(smoothed.subBass, targetEqSubBass, responseBlend);
    smoothed.bass = THREE.MathUtils.lerp(smoothed.bass, targetEqBass, responseBlend);
    smoothed.lowMid = THREE.MathUtils.lerp(smoothed.lowMid, targetEqLowMid, responseBlend);
    smoothed.mid = THREE.MathUtils.lerp(smoothed.mid, targetEqMid, responseBlend);
    smoothed.highMid = THREE.MathUtils.lerp(smoothed.highMid, targetEqHighMid, responseBlend);
    smoothed.presence = THREE.MathUtils.lerp(smoothed.presence, targetEqPresence, responseBlend);
    smoothed.brilliance = THREE.MathUtils.lerp(smoothed.brilliance, targetEqBrilliance, responseBlend);
    smoothed.air = THREE.MathUtils.lerp(smoothed.air, targetEqAir, responseBlend);
    const eqSubBass = smoothed.subBass;
    const eqBass = smoothed.bass;
    const eqLowMid = smoothed.lowMid;
    const eqMid = smoothed.mid;
    const eqHighMid = smoothed.highMid;
    const eqPresence = smoothed.presence;
    const eqBrilliance = smoothed.brilliance;
    const eqAir = smoothed.air;
    const eqAverage = eqBands.reduce((sum, value) => sum + value, 0) / Math.max(1, eqBands.length);
    const eqEnergy = Math.max(0, Math.min(1, data.energy * (0.25 + (eqAverage / 50) * 0.75)));

    // Smoothly transition colors
    const lerpSpeed = 3.0 * delta;
    mat.uBaseColor1.lerp(t.uBaseColor1, lerpSpeed);
    mat.uBaseColor2.lerp(t.uBaseColor2, lerpSpeed);
    mat.uFogColor.lerp(t.uFogColor, lerpSpeed);
    mat.uCoolCore.lerp(t.uCoolCore, lerpSpeed);
    mat.uCoolEdge.lerp(t.uCoolEdge, lerpSpeed);
    mat.uWarmCore.lerp(t.uWarmCore, lerpSpeed);
    mat.uWarmEdge.lerp(t.uWarmEdge, lerpSpeed);
    mat.uRippleColor.lerp(t.uRippleColor, lerpSpeed);
    mat.uGlowIntensity = THREE.MathUtils.lerp(mat.uGlowIntensity, t.uGlowIntensity, lerpSpeed);

    if (fogRef.current) {
        fogRef.current.color.lerp(t.uBaseColor1, lerpSpeed);
    }

    mat.uTime = state.clock.getElapsedTime();
    mat.uBass = eqBass;
    mat.uMid = eqMid;
    mat.uTreble = data.treble;
    mat.uEnergy = eqEnergy;
    
    mat.uSubBass = eqSubBass;
    mat.uLowMid = eqLowMid;
    mat.uHighMid = eqHighMid;
    mat.uPresence = eqPresence;
    mat.uBrilliance = eqBrilliance;
    mat.uAir = eqAir;

    mat.uWarmth = Math.max(0, Math.min(1, (eqSubBass + eqBass + eqLowMid + eqMid) / Math.max(0.001, eqSubBass + eqBass + eqLowMid + eqMid + eqPresence + eqBrilliance + eqAir)));
    mat.uBrightness = Math.max(0, Math.min(1, (eqPresence + eqBrilliance + eqAir) / Math.max(0.001, eqSubBass + eqBass + eqLowMid + eqMid + eqPresence + eqBrilliance + eqAir)));
    mat.uSharpness = data.sharpness;
    mat.uSmoothness = data.smoothness;
    mat.uDensity = data.density;
    mat.uSpectralCentroid = data.spectralCentroid;
    
    // Pass ripples
    mat.uRipples = ripplesRef.current;

    // Update meteors
    if (meteorMeshRef.current) {
        
        if (meteorMatRef.current) {
            const mColor = new THREE.Color().copy(t.uWarmCore).lerp(new THREE.Color(0xffffff), 0.7);
            meteorMatRef.current.color.lerp(mColor, lerpSpeed);
        }

        for (let i = 0; i < MAX_METEORS; i++) {
            const m = meteorsRef.current[i];
            if (!m.active) {
                dummyPosition.set(0, -1000, 0);
                dummyScale.set(0, 0, 0);
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                meteorMeshRef.current.setMatrixAt(i, dummyMatrix);
            } else {
                m.y -= m.speed * 60 * delta; // falling translation (faster)
                if (m.y <= 0) {
                    m.active = false;
                    addRipple(m.x, m.z, Math.min(m.strength * 1.0, 1.2), true); // miniature white wave impact
                    // Impact particles
                    for (let pIndex = 0; pIndex < 10; pIndex++) spawnParticle(m.x, 0.5, m.z, m.speed * 1.5);
                }
                dummyPosition.set(m.x, Math.max(0, m.y), m.z);
                dummyScale.set(1.5, 1.5, 1.5);
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                meteorMeshRef.current.setMatrixAt(i, dummyMatrix);
                
                if (m.y > 0 && Math.random() > 0.3) {
                   spawnParticle(m.x, m.y, m.z, m.speed * 0.2); // trail
                }
            }
        }
        meteorMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    
    // Update particles
    if (particleMeshRef.current) {
        if (particleMatRef.current) particleMatRef.current.color.copy(meteorMatRef.current ? meteorMatRef.current.color : new THREE.Color(0xffffff));
        
        for (let i = 0; i < MAX_PARTICLES; i++) {
           const p = particlesRef.current[i];
           if (!p.active) {
                dummyPosition.set(0, -1000, 0);
                dummyScale.set(0, 0, 0);
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                particleMeshRef.current.setMatrixAt(i, dummyMatrix);
           } else {
                p.life += delta;
                if (p.life >= p.maxLife) {
                    p.active = false;
                    dummyScale.set(0, 0, 0);
                } else {
                    p.x += p.vx * delta * 10;
                    p.y += p.vy * delta * 10;
                    p.z += p.vz * delta * 10;
                    const s = p.scale * (1.0 - (p.life / p.maxLife));
                    dummyPosition.set(p.x, p.y, p.z);
                    dummyScale.set(s, s, s);
                }
                dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
                particleMeshRef.current.setMatrixAt(i, dummyMatrix);
           }
        }
        particleMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // Interaction
  const [pressTime, setPressTime] = useState(0);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return; // Only left click
    setPressTime(performance.now());
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const duration = performance.now() - pressTime;
    // Short click gets a very small strength (~0.2 - 0.4)
    // Long press (1s+) scales up to the max strength of 3.0
    const strength = Math.min(0.2 + (duration / 1000) * 2.8, 3.0);
    addRipple(e.point.x, e.point.z, strength);
  };

  const t = themeColors;

  return (
    <>
      <fog ref={fogRef} attach="fog" args={[`#${t.uBaseColor1.getHexString()}`, 30, 95]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} />
      
      <OrbitControls 
        ref={controlsRef}
        makeDefault 
        autoRotate 
        autoRotateSpeed={rotationSpeed}
        enablePan={false}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
        minDistance={5}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2 - 0.1}
      />

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[0.9, 1, 0.9]} />
        {/* @ts-ignore */}
        <mapShaderMaterial ref={materialRef} transparent={true} />
      </instancedMesh>

      <instancedMesh ref={meteorMeshRef} args={[undefined as any, undefined as any, MAX_METEORS]} frustumCulled={false}>
         <boxGeometry args={[0.4, 1.2, 0.4]} />
         <meshBasicMaterial ref={meteorMatRef} color="#ffffff" toneMapped={false} /> 
      </instancedMesh>

      <instancedMesh ref={particleMeshRef} args={[undefined as any, undefined as any, MAX_PARTICLES]} frustumCulled={false}>
         <boxGeometry args={[0.8, 0.8, 0.8]} />
         <meshBasicMaterial ref={particleMatRef} color="#ffffff" toneMapped={false} transparent={true} opacity={0.6} /> 
      </instancedMesh>
    </>
  );
}
