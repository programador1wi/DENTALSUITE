import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "var(--bg-subtle)",
          100: "var(--bg-subtle)",
          200: "var(--border-default)",
          300: "var(--border-strong)",
          400: "var(--text-secondary)",
          500: "var(--text-secondary)",
          600: "var(--text-secondary)",
          700: "var(--text-primary)",
          800: "var(--text-primary)",
          900: "var(--text-brand-strong)"
        },
        gray: {
          50: "var(--bg-subtle)",
          100: "var(--bg-subtle)",
          200: "var(--border-default)",
          300: "var(--border-strong)",
          400: "var(--text-secondary)",
          500: "var(--text-secondary)",
          600: "var(--text-secondary)",
          700: "var(--text-primary)",
          800: "var(--text-primary)",
          900: "var(--text-brand-strong)"
        },
        zinc: {
          50: "var(--bg-subtle)",
          100: "var(--bg-subtle)",
          200: "var(--border-default)",
          300: "var(--border-strong)",
          400: "var(--text-secondary)",
          500: "var(--text-secondary)",
          600: "var(--text-secondary)",
          700: "var(--text-primary)",
          800: "var(--text-primary)",
          900: "var(--text-brand-strong)"
        },
        sky: {
          50: "var(--bg-brand-light)",
          100: "var(--bg-brand-light)",
          200: "var(--border-brand-light)",
          300: "var(--border-brand-light)",
          500: "var(--text-brand)",
          600: "var(--text-brand)",
          700: "var(--text-brand-strong)"
        },
        blue: {
          50: "var(--bg-brand-light)",
          100: "var(--bg-brand-light)",
          200: "var(--border-brand-light)",
          400: "var(--nav-item-active-text)",
          500: "var(--text-brand)",
          600: "var(--action-brand-hover)",
          700: "var(--text-brand-strong)",
          900: "var(--text-brand-strong)"
        },
        cyan: {
          50: "var(--bg-brand-light)",
          200: "var(--border-brand-light)",
          500: "var(--text-brand)",
          700: "var(--text-brand-strong)",
          900: "var(--text-brand-strong)"
        },
        indigo: {
          50: "var(--bg-brand-light)",
          200: "var(--border-brand-light)",
          500: "var(--text-brand)",
          700: "var(--text-brand-strong)",
          900: "var(--text-brand-strong)"
        },
        purple: {
          50: "var(--status-purple-bg)",
          200: "var(--status-purple-bg)",
          500: "var(--status-purple-text)",
          700: "var(--status-purple-text)",
          900: "var(--status-purple-text)"
        },
        emerald: {
          50: "var(--status-success-bg)",
          100: "var(--status-success-bg)",
          200: "var(--status-success-bg)",
          500: "var(--action-primary)",
          600: "var(--action-primary-hover)",
          700: "var(--status-success-text)",
          800: "var(--status-success-text)",
          900: "var(--status-success-text)"
        },
        amber: {
          50: "var(--status-warning-bg)",
          100: "var(--status-warning-bg)",
          200: "var(--status-warning-bg)",
          400: "var(--text-warning)",
          500: "var(--text-warning)",
          700: "var(--status-warning-text)",
          800: "var(--status-warning-text)",
          900: "var(--status-warning-text)"
        },
        orange: {
          50: "var(--status-warning-bg)",
          200: "var(--status-warning-bg)",
          500: "var(--text-warning)",
          700: "var(--status-rescheduled-text)",
          900: "var(--status-rescheduled-text)"
        },
        red: {
          50: "var(--status-danger-bg)",
          100: "var(--status-danger-bg)",
          200: "var(--status-danger-bg)",
          300: "var(--status-danger-bg)",
          500: "var(--text-danger)",
          600: "var(--text-danger)",
          700: "var(--status-danger-text)",
          800: "var(--status-danger-text)",
          900: "var(--status-danger-text)"
        },
        rose: {
          50: "var(--status-danger-bg)",
          200: "var(--status-danger-bg)",
          500: "var(--text-danger)",
          600: "var(--status-no-show-text)",
          700: "var(--status-no-show-text)",
          900: "var(--status-no-show-text)"
        },
        brand: {
          50: "var(--bg-brand-light)",
          100: "var(--border-brand-light)",
          500: "var(--action-brand)",
          600: "var(--action-brand-hover)",
          700: "var(--action-brand-hover)"
        },
        clinical: {
          success: "var(--text-success)",
          warning: "var(--text-warning)",
          danger: "var(--text-danger)",
          info: "var(--text-brand)",
          accent: "var(--text-brand)"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
