import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "./login-particle-background.css";

// Check if WebGL is available in the current browser environment
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uPointer;

  attribute float aOrbitAngle;
  attribute float aTubeAngle;
  attribute float aRadius;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aSize;
  attribute float aRotation;
  attribute float aAlpha;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vRotation;
  varying float vDepth;
  varying float vAlpha;
  varying float vCenterFade;

  void main() {
    vColor = aColor;
    vRotation = aRotation;
    vAlpha = aAlpha;

    // Slow orbital rotation for a subtle drifting flow
    float orbitalTime = uTime * 0.008 * aSpeed + aPhase;
    float u = aOrbitAngle + orbitalTime;
    // Extremely slow spiral rotation inside the tube
    float v = aTubeAngle + orbitalTime * 0.25;

    // Organic deformation via gentle sine waves
    float R = 3.65; // Major radius pushed outward to clear the center
    float rBase = aRadius * 0.72; // Thin tube to focus density to periphery
    float rFinal = rBase 
      + sin(u * 3.0 + uTime * 0.22 + aPhase) * 0.08
      + sin(v * 5.0 - uTime * 0.14) * 0.04;

    // Parametric torus coordinate calculations
    vec3 pos;
    pos.x = (R + rFinal * cos(v)) * cos(u);
    pos.y = rFinal * sin(v);
    pos.z = (R + rFinal * cos(v)) * sin(u);

    // Adapt to widescreen horizontal format (scale width)
    pos.x *= 1.32;

    // Smooth mathematical center fading: hides particles when they get near the center
    // length(pos.xy) represents horizontal/vertical distance from screen center
    vCenterFade = smoothstep(1.3, 2.9, length(pos.xy));

    // Parallax translation relative to camera depth
    float parallaxFactor = (pos.z + 4.5) / 9.0; // 0 to 1
    pos.xy += uPointer * parallaxFactor * 0.30;

    // Model view projection matrix transformation
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Distance from the camera
    vDepth = -mvPosition.z;

    // Perspective point sizing
    float perspectiveFactor = 15.0 / vDepth;
    gl_PointSize = clamp(aSize * perspectiveFactor, 1.0, 7.0); // Clamp to avoid overly large pixels near screen
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vRotation;
  varying float vDepth;
  varying float vAlpha;
  varying float vCenterFade;

  void main() {
    // Offset point coord mapping to center
    vec2 centered = gl_PointCoord - vec2(0.5);

    // Apply rotation matrix for individual fragment orientations
    float angle = vRotation;
    mat2 rotationMatrix = mat2(
      cos(angle), -sin(angle),
      sin(angle), cos(angle)
    );

    vec2 rotated = rotationMatrix * centered;

    float horizontal = abs(rotated.x);
    float vertical = abs(rotated.y);

    // Normalize depth range (near: ~4.0, far: ~11.0)
    float depthNormalized = clamp((vDepth - 4.0) / 7.0, 0.0, 1.0);

    // Simulated Depth-of-Field (DoF) / Bokeh:
    // Distant particles are drawn with a wider smoothstep range, creating a soft blur/misty visual.
    // Near particles are drawn with sharp boundaries.
    float innerLimitX = mix(0.44, 0.04, depthNormalized);
    float innerLimitY = mix(0.015, 0.001, depthNormalized);
    float outerLimitY = mix(0.038, 0.12, depthNormalized); // Grows slightly when out of focus

    // Draw ultra-thin needle/dash shape
    float borderX = smoothstep(0.48, innerLimitX, horizontal);
    float borderY = smoothstep(outerLimitY, innerLimitY, vertical);
    float shapeAlpha = borderX * borderY;

    if (shapeAlpha <= 0.0) {
      discard;
    }

    // Depth-based opacity fading
    float depthOpacity = mix(0.9, 0.1, depthNormalized);

    // Multiply components to obtain final translucent corporate aesthetics
    gl_FragColor = vec4(vColor, shapeAlpha * vAlpha * depthOpacity * vCenterFade);
  }
`;

function LoginParticleBackgroundComponent() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    // 1. WebGL Fallback Check
    if (!isWebGLAvailable()) {
      setWebglSupported(false);
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 2. Reduced Motion preference
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 3. Setup Scene, Camera and Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.z = 7.5;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height, false);

    // Low, restricted pixel ratio for top-tier rendering efficiency
    const isMobile = window.innerWidth < 768;
    const maxDpr = isMobile ? 1.0 : 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));

    // 4. Generate Particles Geometry and Attributes
    const getParticleCount = () => {
      if (prefersReduced) return 600;
      return isMobile ? 1000 : 3000;
    };

    const particleCount = getParticleCount();
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const orbitAngles = new Float32Array(particleCount);
    const tubeAngles = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const rotations = new Float32Array(particleCount);
    const alphas = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);

    // Highly sober and professional corporate color palette (neutrals + desaturated blue accent)
    const palette = [
      new THREE.Color("#1e293b"), // Slate dark
      new THREE.Color("#334155"), // Slate medium dark
      new THREE.Color("#475569"), // Slate gray
      new THREE.Color("#64748b"), // Cool gray
      new THREE.Color("#94a3b8"), // Light cool gray
      new THREE.Color("#cbd5e1"), // Light gray
      new THREE.Color("#185fa5"), // Corporate blue accent (used very sparingly)
    ];

    for (let i = 0; i < particleCount; i++) {
      orbitAngles[i] = Math.random() * Math.PI * 2;
      tubeAngles[i] = Math.random() * Math.PI * 2;
      radii[i] = 0.5 + Math.random() * 0.45; // thickness variation
      speeds[i] = 0.6 + Math.random() * 0.8;
      phases[i] = Math.random() * Math.PI * 2;
      
      // Sizes distribution: 80% micropartículas, 16% medianas, 4% grandes
      const rSize = Math.random() * 100;
      let s;
      if (rSize < 80) {
        s = 1.0 + Math.random() * 1.2; // 1.0 to 2.2px
      } else if (rSize < 96) {
        s = 2.2 + Math.random() * 1.8; // 2.2 to 4.0px
      } else {
        s = 4.0 + Math.random() * 1.5; // 4.0 to 5.5px
      }
      sizes[i] = s;
      
      rotations[i] = Math.random() * Math.PI * 2;

      // Opacity distribution: 70% highly translucent, 20% medium, 10% slightly more visible
      const rAlpha = Math.random() * 100;
      if (rAlpha < 70) {
        alphas[i] = 0.05 + Math.random() * 0.12;
      } else if (rAlpha < 90) {
        alphas[i] = 0.17 + Math.random() * 0.20;
      } else {
        alphas[i] = 0.37 + Math.random() * 0.25;
      }

      // Color distribution: 92% grays/neutrals, 8% subtle blue accent
      const rColor = Math.random() * 100;
      let col = palette[0];
      if (rColor < 92) {
        col = palette[Math.floor(Math.random() * 6)];
      } else {
        col = palette[6]; // Subtle corporate blue accent
      }

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aOrbitAngle", new THREE.BufferAttribute(orbitAngles, 1));
    geometry.setAttribute("aTubeAngle", new THREE.BufferAttribute(tubeAngles, 1));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aRotation", new THREE.BufferAttribute(rotations, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    // 5. Shader Material Setup
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
      },
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // 6. Interactive Cursor Tracking (Smooth Parallax)
    const pointerTarget = new THREE.Vector2(0, 0);
    const currentPointer = new THREE.Vector2(0, 0);

    const handlePointerMove = (event: MouseEvent) => {
      if (prefersReduced) return;
      pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerTarget.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    if (!prefersReduced) {
      window.addEventListener("mousemove", handlePointerMove);
    }

    // 7. Visibility Observers
    let isPageVisible = document.visibilityState === "visible";
    let isComponentVisible = true;

    const handleVisibilityChange = () => {
      isPageVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries && entries[0]) {
          isComponentVisible = entries[0].isIntersecting;
        }
      },
      { threshold: 0.1 }
    );
    intersectionObserver.observe(container);

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(container);

    // 9. Animation Loop
    const clock = new THREE.Clock();
    let animationFrameId = 0;

    const tick = () => {
      if (isPageVisible && isComponentVisible) {
        // Slow speed for clean, corporative flow
        const speedFactor = prefersReduced ? 0.02 : 1.0;
        const elapsed = clock.getElapsedTime() * speedFactor;

        if (!prefersReduced) {
          currentPointer.x += (pointerTarget.x - currentPointer.x) * 0.035;
          currentPointer.y += (pointerTarget.y - currentPointer.y) * 0.035;
        }

        material.uniforms.uTime.value = elapsed;
        material.uniforms.uPointer.value.copy(currentPointer);

        // Slow system drift rotations (extremely organic)
        points.rotation.y = elapsed * 0.005;
        points.rotation.x = elapsed * 0.0025;

        renderer.render(scene, camera);
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    // 10. Clean-up resources on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      
      if (!prefersReduced) {
        window.removeEventListener("mousemove", handlePointerMove);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  if (!webglSupported) {
    return (
      <div aria-hidden="true" className="login-particle-background-container">
        <div className="login-particle-background-mask" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="login-particle-background-container"
    >
      <canvas ref={canvasRef} className="login-particle-background-canvas" />
      <div className="login-particle-background-mask" />
    </div>
  );
}

export const LoginParticleBackground = React.memo(LoginParticleBackgroundComponent);
