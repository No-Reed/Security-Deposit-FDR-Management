/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Notion-inspired: clean whites, soft grays, minimal accents
        background: 'hsl(0 0% 98%)',
        foreground: 'hsl(220 10% 15%)',
        card: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(220 10% 15%)',
        },
        popover: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(220 10% 15%)',
        },
        primary: {
          DEFAULT: 'hsl(20 85% 40%)',
          foreground: 'hsl(0 0% 100%)',
        },
        secondary: {
          DEFAULT: 'hsl(220 10% 94%)',
          foreground: 'hsl(220 10% 30%)',
        },
        muted: {
          DEFAULT: 'hsl(220 10% 96%)',
          foreground: 'hsl(220 10% 45%)',
        },
        accent: {
          DEFAULT: 'hsl(220 10% 93%)',
          foreground: 'hsl(220 10% 25%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 72% 51%)',
          foreground: 'hsl(0 0% 100%)',
        },
        border: 'hsl(220 13% 90%)',
        input: 'hsl(220 13% 90%)',
        ring: 'hsl(20 85% 40%)',
        // Status colors
        status: {
          draft: 'hsl(220 10% 70%)',
          submitted: 'hsl(200 80% 45%)',
          review: 'hsl(35 95% 50%)',
          verified: 'hsl(142 71% 45%)',
          rejected: 'hsl(0 72% 51%)',
          action: 'hsl(25 95% 53%)',
          closed: 'hsl(220 10% 55%)',
          active: 'hsl(142 71% 45%)',
          expiring: 'hsl(35 95% 50%)',
          matured: 'hsl(0 72% 51%)',
          expired: 'hsl(0 50% 40%)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      boxShadow: {
        notion: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'notion-md': '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
        'notion-lg': '0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
