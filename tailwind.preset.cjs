/**
 * Still design tokens — Tailwind CSS v3 compatibility preset.
 *
 * Usage: require this file from the presets array in tailwind.config.cjs,
 * then configure that project's normal content paths alongside it.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: '#f7f8f5',
        surface: '#ffffff',
        ink: '#202522',
        muted: '#6b726c',
        line: '#dde1dc',
        sage: {
          DEFAULT: '#567362',
          hover: '#465f50',
          soft: '#e5ece7',
        },
        danger: {
          DEFAULT: '#9b3b3b',
          soft: '#f5e9e7',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        reading: ['Georgia', 'Times New Roman', 'serif'],
      },
      fontSize: {
        meta: ['0.6875rem', { lineHeight: '0.9375rem' }],
        label: ['0.75rem', { lineHeight: '1rem' }],
        body: ['0.9375rem', { lineHeight: '1.5625rem' }],
        quote: ['1rem', { lineHeight: '1.5625rem' }],
        reading: ['1.125rem', { lineHeight: '1.875rem' }],
        title: [
          '2rem',
          { lineHeight: '2.375rem', letterSpacing: '-0.025em' },
        ],
      },
      borderRadius: {
        control: '0.5rem',
        card: '0.75rem',
        pill: '9999px',
      },
      maxWidth: {
        feed: '38.125rem',
        nav: '11.875rem',
        context: '13.75rem',
        shell: '72.5rem',
      },
      spacing: {
        layout: '4.375rem',
        post: '1.75rem',
        touch: '2.75rem',
      },
      boxShadow: {
        float: '0 8px 24px rgb(32 37 34 / 0.08)',
      },
      transitionDuration: {
        calm: '150ms',
        reveal: '200ms',
      },
      transitionTimingFunction: {
        still: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      screens: {
        feed: '640px',
        shell: '800px',
        context: '1000px',
      },
    },
  },
};
