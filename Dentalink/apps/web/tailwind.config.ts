import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f6ff",
          100: "#e0eefe",
          500: "#2563eb",
          700: "#1d4ed8"
        },
        clinical: {
          success: "#10b981",  // Verde completado / aprobado
          warning: "#f59e0b",  // Naranja en progreso
          danger: "#ef4444",   // Rojo alerta / cancelado
          info: "#3b82f6",     // Azul planeado
          accent: "#8b5cf6"    // Púrpura especial
        }
      }
    }
  },
  plugins: []
} satisfies Config;
