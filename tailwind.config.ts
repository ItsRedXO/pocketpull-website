import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        rarity: {
          common: 'hsl(var(--rarity-common))',
          uncommon: 'hsl(var(--rarity-uncommon))',
          rare: 'hsl(var(--rarity-rare))',
          ultra: 'hsl(var(--rarity-ultra))',
          secret: 'hsl(var(--rarity-secret))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Rajdhani', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'rainbow': 'linear-gradient(45deg, #ff0060, #ff7f00, #ffff00, #00ff80, #00c8ff, #9b5cff)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { left: '-100%' },
          '100%': { left: '200%' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px -5px hsl(195 100% 50% / 0.4)' },
          '50%': { boxShadow: '0 0 30px -3px hsl(195 100% 50% / 0.9)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'rainbow-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'level-fill': {
          from: { width: '0' },
          to: { width: '72%' },
        },
        'blink-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        marquee: 'marquee 30s linear infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        'rainbow-shift': 'rainbow-shift 3s linear infinite',
        'level-fill': 'level-fill 2s ease-out forwards',
        'blink-dot': 'blink-dot 1s ease-in-out infinite',
      },
      boxShadow: {
        'neon-blue': '0 0 20px -5px hsl(195 100% 50% / 0.6), 0 0 40px -15px hsl(195 100% 50% / 0.3)',
        'neon-purple': '0 0 20px -5px hsl(267 100% 67% / 0.6), 0 0 40px -15px hsl(267 100% 67% / 0.3)',
        'neon-gold': '0 0 20px -5px hsl(45 100% 50% / 0.6), 0 0 40px -15px hsl(45 100% 50% / 0.3)',
      },
    },
  },
  plugins: [animate],
} satisfies Config
