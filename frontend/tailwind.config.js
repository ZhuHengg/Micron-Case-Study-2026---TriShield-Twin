/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          50: 'var(--bg-50)',
          100: 'var(--bg-100)',
          200: 'var(--bg-200)',
          300: 'var(--bg-300)',
        },
        border: {
          DEFAULT: 'var(--border)',
          md: 'var(--border-md)',
        },
        cyan: {
          900: 'var(--cyan-900)',
          700: 'var(--cyan-700)',
          500: 'var(--cyan-500)',
          400: 'var(--cyan-400)',
          100: 'var(--cyan-100)',
          50:  'var(--cyan-50)',
        },
        teal: {
          700: 'var(--teal-700)',
          500: 'var(--teal-500)',
          400: 'var(--teal-400)',
          200: 'var(--teal-200)',
          50:  'var(--teal-50)',
        },
        decision: {
          approve: 'var(--approve)',
          flag: 'var(--flag)',
          block: 'var(--block)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          white: 'var(--text-white)',
        },
        status: {
          pass: 'var(--status-pass)',
          marginal: 'var(--status-marginal)',
          reject: 'var(--status-reject)',
        }
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
        `,
        'gradient-signature': 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
      },
      backgroundSize: {
        'grid': '28px 28px'
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        'glow-cyan': '0 0 0 3px rgba(6,182,212,0.1)',
        'glow-teal': '0 0 0 3px rgba(20,184,166,0.1)',
        'glow-approve': '0 0 0 3px rgba(16,185,129,0.1)',
        'glow-flag': '0 0 0 3px rgba(245,158,11,0.1)',
        'glow-block': '0 0 0 3px rgba(239,68,68,0.1)',
        'btn-primary': '0 4px 14px rgba(59,130,246,0.25)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        'pill': '9999px',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      },
      animation: {
        'slide-in': 'slideIn 0.25s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse-slow 3s infinite',
        'shimmer': 'shimmer 2s infinite linear',
      }
    },
  },
  plugins: [],
}
