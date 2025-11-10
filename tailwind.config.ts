import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB', // Blue
          light: '#3b82f6',
          dark: '#1e40af',
        },
        secondary: {
          DEFAULT: '#DC2626', // Red
          light: '#ef4444',
          dark: '#b91c1c',
        },
        success: {
          DEFAULT: '#059669',
          light: '#10b981',
          dark: '#047857',
        },
        warning: {
          DEFAULT: '#EA580C',
          light: '#f97316',
          dark: '#c2410c',
        },
        info: {
          DEFAULT: '#7C3AED',
          light: '#8b5cf6',
          dark: '#6d28d9',
        },
        neutral: {
          bg: '#F9FAFB',
          text: '#111827',
          light: '#F3F4F6',
          medium: '#9CA3AF',
          dark: '#374151',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'club-gradient': 'linear-gradient(135deg, #2563EB 0%, #DC2626 100%)',
        'primary-gradient': 'linear-gradient(135deg, #2563EB 0%, #DC2626 100%)',
      },
      boxShadow: {
        'soft': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'medium': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'large': '0 20px 25px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        'gutter': '16px',
        'gutter-lg': '24px',
      },
      maxWidth: {
        'container': '1400px',
      },
      transitionDuration: {
        'default': '200ms',
        'slow': '300ms',
      },
    },
  },
  plugins: [],
}
export default config



