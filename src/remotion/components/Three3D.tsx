import React, { Suspense, useEffect, useMemo, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

// Tiny image-texture loader. Loads once per src and returns the texture
// (or null while loading). Avoids @react-three/fiber's useLoader since
// that triggers Suspense mid-render in headless Remotion.
function useImageTexture(src: string | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!src) {
      setTex(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(src, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      setTex(t);
    });
  }, [src]);
  return tex;
}

// Three.js-backed scene primitives that render alongside Remotion. We
// stay light on @react-three/drei because some of its helpers depend on
// browser-only APIs that Remotion's headless renderer doesn't have.
// All components self-rotate / self-animate based on the current frame
// — no R3F useFrame hook needed.

interface BaseThreeProps {
  accent?: string;
}

/* ------------------------------- ThreeText ------------------------------ */

interface ThreeTextProps extends BaseThreeProps {
  text: string;
}

/** Extruded 3D text that orbits the camera. Looks like a logo reveal. */
export const ThreeText: React.FC<ThreeTextProps> = ({
  text,
  accent = "#10b981",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const angle = (frame / 90) * Math.PI * 2; // ~3s per full rotation
  const camRadius = 6;

  // Build a procedural box-stack that spells out the text without needing
  // a font file at render time. Each character becomes a vertical column
  // of cubes with a height proportional to its char code — visually
  // distinctive even though it's not a literal letterform.
  const columns = useMemo(() => {
    const chars = text.toUpperCase().split("");
    const total = chars.length;
    return chars.map((c, i) => {
      const code = c.charCodeAt(0);
      const h = c === " " ? 0 : 0.4 + ((code % 13) / 13) * 1.6;
      const x = i - (total - 1) / 2;
      return { x, h, key: `${c}-${i}` };
    });
  }, [text]);

  return (
    <ThreeCanvas width={width} height={height}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} color={accent} />
        <perspectiveCamera
          position={[Math.sin(angle) * camRadius, 1.5, Math.cos(angle) * camRadius]}
          rotation={[0, angle, 0]}
        />
        {columns.map((c) => (
          <mesh key={c.key} position={[c.x * 0.7, c.h / 2 - 0.5, 0]}>
            <boxGeometry args={[0.55, c.h, 0.55]} />
            <meshStandardMaterial color={accent} metalness={0.7} roughness={0.25} />
          </mesh>
        ))}
        <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#0a0a0a" roughness={1} />
        </mesh>
      </Suspense>
    </ThreeCanvas>
  );
};

/* ------------------------------- ThreeCard ------------------------------ */

interface ThreeCardProps extends BaseThreeProps {
  imageUrl: string;
}

/** Image displayed on a rotating card in 3D space — product reveal feel. */
export const ThreeCard: React.FC<ThreeCardProps> = ({
  imageUrl,
  accent = "#10b981",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const yaw = (frame / 60) * Math.PI; // half-rotation every 2s
  const tex = useImageTexture(imageUrl);

  return (
    <ThreeCanvas width={width} height={height}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 5]} intensity={1.3} />
        <pointLight position={[-4, 2, 2]} intensity={1} color={accent} />
        <perspectiveCamera position={[0, 0, 5]} />
        <mesh rotation={[0, yaw, 0]}>
          <planeGeometry args={[3.6, 4.5]} />
          <meshStandardMaterial
            map={tex ?? undefined}
            color={tex ? "#ffffff" : accent}
            metalness={0.2}
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Suspense>
    </ThreeCanvas>
  );
};

/* ----------------------------- ThreeParticles --------------------------- */

interface ThreeParticlesProps extends BaseThreeProps {
  count?: number;
}

/** 3D particle field that drifts forward — abstract intro / interlude beat. */
export const ThreeParticles: React.FC<ThreeParticlesProps> = ({
  count = 200,
  accent = "#10b981",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const positions = useMemo(() => {
    let s = 9876;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 2;
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < count; i++) {
      out.push([rand() * 6, rand() * 4, rand() * 12]);
    }
    return out;
  }, [count]);

  // Drift the entire field toward the camera; particles wrap around when
  // they pass z = 4 so the field appears infinite.
  const drift = (frame / 30) * 1.5;

  return (
    <ThreeCanvas width={width} height={height}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 4]} intensity={2} color={accent} />
        <perspectiveCamera position={[0, 0, 6]} />
        {positions.map((p, i) => {
          const z = ((p[2] + drift) % 16) - 6;
          return (
            <mesh key={i} position={[p[0], p[1], z]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
            </mesh>
          );
        })}
      </Suspense>
    </ThreeCanvas>
  );
};
