/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  prefix: 'ew-',
  theme: {
    extend: {
      keyframes: {
        /** Same 3D tilt as Payment-Gateway-Portal `agent-fab-3d` (Dashboard FAB). */
        'agent-fab-3d': {
          '0%, 100%': {
            transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)',
          },
          '25%': {
            transform:
              'translate3d(2px, -3px, 6px) rotateX(10deg) rotateY(-12deg)',
          },
          '50%': {
            transform:
              'translate3d(-1px, 2px, 2px) rotateX(-6deg) rotateY(8deg)',
          },
          '75%': {
            transform:
              'translate3d(-2px, -2px, 4px) rotateX(8deg) rotateY(6deg)',
          },
        },
      },
      animation: {
        'agent-fab-3d': 'agent-fab-3d 3.6s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        /** Chatak admin portal `--brand-primary` / `text-primary` (hsl 199 54% 28% ≈ #20556e). */
        primary: {
          DEFAULT: '#20556e',
          foreground: '#ffffff',
        },
        embed: {
          /** Girmiti site primary (from https://girmiti.com/ css/style.css) */
          accent: '#31a600',
          accentHover: '#289008',
          teal: '#2b95b3',
          surface: '#ffffff',
          surfaceMuted: '#f6f7f6',
        },
      },
      boxShadow: {
        panel:
          '0 18px 50px -14px rgba(22, 60, 18, 0.14), 0 0 0 1px rgba(49, 166, 0, 0.08)',
        launcher:
          '0 12px 36px -10px rgba(49, 166, 0, 0.22), 0 2px 10px -2px rgba(15, 23, 42, 0.1)',
      },
    },
  },
  plugins: [],
};
