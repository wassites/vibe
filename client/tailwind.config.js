/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        vibe: {
          bg:        'var(--bg)',
          panel:     'var(--panel)',
          surface:   'var(--surface)',
          hover:     'var(--hover)',
          border:    'var(--border)',
          accent:    'var(--accent)',
          accentDim: 'var(--accent-dim)',
          bubbleOut: 'var(--bubble-out)',
          bubbleIn:  'var(--bubble-in)',
          text:      'var(--text)',
          muted:     'var(--muted)',
          input:     'var(--input-bg)',
          // mantém compatibilidade com código antigo
          purple:    'var(--accent)',
          purpleDim: 'var(--accent-dim)',
        },
      },
      backgroundImage: {
        'gradient-vibe': 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)',
      },
    },
  },
  plugins: [],
};
