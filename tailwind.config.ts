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
          DEFAULT: 'var(--tm-primary, #2563EB)',
          light: 'var(--tm-primary-light, #3b82f6)',
          lighter: 'var(--tm-primary-lighter, #60a5fa)',
          dark: 'var(--tm-primary-dark, #1e40af)',
          subtle: 'var(--tm-primary-subtle, #eff6ff)',
          border: 'var(--tm-primary-border, #bfdbfe)',
        },
        secondary: {
          DEFAULT: 'var(--tm-secondary, #DC2626)',
          light: 'var(--tm-secondary-light, #ef4444)',
          dark: 'var(--tm-secondary-dark, #b91c1c)',
          subtle: 'var(--tm-secondary-subtle, #fef2f2)',
        },
        // ── Core brand (tm-* aliases for Color Engine compatibility) ──
        'tm-primary':           'var(--tm-primary)',
        'tm-primary-light':     'var(--tm-primary-light)',
        'tm-primary-lighter':   'var(--tm-primary-lighter)',
        'tm-primary-dark':      'var(--tm-primary-dark)',
        'tm-primary-subtle':    'var(--tm-primary-subtle)',
        'tm-primary-border':    'var(--tm-primary-border)',

        'tm-secondary':         'var(--tm-secondary)',
        'tm-secondary-light':   'var(--tm-secondary-light)',
        'tm-secondary-dark':    'var(--tm-secondary-dark)',
        'tm-secondary-subtle':  'var(--tm-secondary-subtle)',

        // ── Text on brand ──
        'tm-on-primary':        'var(--tm-text-on-primary)',
        'tm-on-primary-muted':  'var(--tm-text-on-primary-muted)',
        'tm-on-secondary':      'var(--tm-text-on-secondary)',

        // ── Sidebar ──
        'tm-sidebar':           'var(--tm-sidebar-bg)',
        'tm-sidebar-text':      'var(--tm-sidebar-text)',
        'tm-sidebar-muted':     'var(--tm-sidebar-text-muted)',
        'tm-sidebar-active':    'var(--tm-sidebar-active-bg)',
        'tm-sidebar-hover':     'var(--tm-sidebar-hover-bg)',
        'tm-sidebar-border':    'var(--tm-sidebar-border)',

        // ── Accent ──
        'tm-accent':            'var(--tm-accent)',
        'tm-accent-text':       'var(--tm-accent-text)',

        // ── Stat icons ──
        'tm-icon':              'var(--tm-icon-bg)',
        'tm-icon-text':         'var(--tm-icon-color)',

        // ── Buttons ──
        'tm-btn-primary':       'var(--tm-btn-primary-bg)',
        'tm-btn-primary-hover': 'var(--tm-btn-primary-hover)',
        'tm-btn-secondary':     'var(--tm-btn-secondary-bg)',
        'tm-btn-outline-border':'var(--tm-btn-outline-border)',

        // ── Badges ──
        'tm-badge':             'var(--tm-badge-bg)',
        'tm-badge-text':        'var(--tm-badge-text)',
        'tm-badge-sec':         'var(--tm-badge-secondary-bg)',
        'tm-badge-sec-text':    'var(--tm-badge-secondary-text)',

        // ── Charts ──
        'tm-chart':             'var(--tm-chart-primary)',
        'tm-chart-sec':         'var(--tm-chart-secondary)',

        // ── Generic surface / text / border (dark/light mode adaptive) ──
        'tm-bg': {
          DEFAULT: 'var(--tm-bg)',
          elevated: 'var(--tm-bg-elevated)',
        },
        'tm-surface': {
          DEFAULT: 'var(--tm-surface)',
          elevated: 'var(--tm-surface-elevated)',
          hover: 'var(--tm-surface-hover)',
        },
        'tm-text': {
          DEFAULT: 'var(--tm-text-1)',
          1: 'var(--tm-text-1)',
          2: 'var(--tm-text-2)',
          3: 'var(--tm-text-3)',
          muted: 'var(--tm-text-muted)',
        },
        'tm-border': {
          DEFAULT: 'var(--tm-border)',
          strong: 'var(--tm-border-strong)',
        },
        'tm-input': {
          DEFAULT: 'var(--tm-input-bg)',
          border: 'var(--tm-input-border)',
        },
        'tm-divider': 'var(--tm-divider)',
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



