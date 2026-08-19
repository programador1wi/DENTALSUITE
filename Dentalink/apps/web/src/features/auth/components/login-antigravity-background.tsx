import { useEffect, useRef } from "react";

type Dash = {
  ringRadius: number;
  baseAngle: number;
  angleJitter: number;
  length: number;
  thickness: number;
  alpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
};

const TWO_PI = Math.PI * 2;
const CENTER_X_FACTOR = 0.51;
const CENTER_Y_FACTOR = 0.54;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildField(maxRadius: number) {
  const dashes: Dash[] = [];
  const ringStart = 80;
  const ringStep = 28;

  for (let radius = ringStart; radius <= maxRadius; radius += ringStep) {
    const circumference = TWO_PI * radius;
    const dashCount = Math.floor(circumference / 24);
    const ringJitter = (radius % 37) * 0.0007;

    for (let index = 0; index < dashCount; index += 1) {
      if (Math.random() < 0.08) {
        continue;
      }

      const baseAngle = (index / dashCount) * TWO_PI;
      const radialFactor = radius / maxRadius;

      dashes.push({
        ringRadius: radius + (Math.random() - 0.5) * 4,
        baseAngle,
        angleJitter: ringJitter * (Math.random() > 0.5 ? 1 : -1),
        length: clamp(1.8 + radialFactor * 5.4 + Math.random() * 0.8, 1.8, 8.8),
        thickness: clamp(0.9 + radialFactor * 1.35 + Math.random() * 0.3, 0.9, 2.9),
        alpha: clamp(0.2 + radialFactor * 0.65 + Math.random() * 0.12, 0.16, 0.82),
        twinklePhase: Math.random() * TWO_PI,
        twinkleSpeed: 0.7 + Math.random() * 1.2
      });
    }
  }

  return dashes;
}

export function LoginAntigravityBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let animationFrame = 0;
    let dashes: Dash[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const maxRadius = Math.hypot(width, height) * 0.72;
      dashes = buildField(maxRadius);
    };

    const draw = (timeMs: number) => {
      if (document.hidden) {
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width * CENTER_X_FACTOR;
      const centerY = height * CENTER_Y_FACTOR;
      const time = timeMs * 0.001;

      context.clearRect(0, 0, width, height);
      context.fillStyle = "#f1f2f4";
      context.fillRect(0, 0, width, height);

      for (const dash of dashes) {
        const spin = time * (0.016 + dash.ringRadius * 0.000024);
        const angle = dash.baseAngle + spin + dash.angleJitter;
        const x = centerX + Math.cos(angle) * dash.ringRadius;
        const y = centerY + Math.sin(angle) * dash.ringRadius;
        const tangent = angle + Math.PI * 0.5;
        const halfLength = dash.length * 0.5;
        const twinkle = 0.74 + Math.sin(time * dash.twinkleSpeed + dash.twinklePhase) * 0.26;
        const alpha = clamp(dash.alpha * twinkle, 0.08, 0.9);

        const lightness = 64 + (dash.ringRadius % 16);
        context.strokeStyle = `hsla(215, 12%, ${lightness}%, ${alpha * 0.45})`;
        context.lineCap = "round";
        context.lineWidth = dash.thickness;
        context.beginPath();
        context.moveTo(x - Math.cos(tangent) * halfLength, y - Math.sin(tangent) * halfLength);
        context.lineTo(x + Math.cos(tangent) * halfLength, y + Math.sin(tangent) * halfLength);
        context.stroke();
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    animationFrame = window.requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      } else {
        if (!animationFrame) {
          animationFrame = window.requestAnimationFrame(draw);
        }
      }
    };
    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("resize", onResize);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-[#f1f2f4]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_38%,rgba(255,255,255,0.65)_100%)]" />
    </div>
  );
}
