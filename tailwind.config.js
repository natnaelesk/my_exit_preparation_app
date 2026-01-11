/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-based primary color (set dynamically via CSS variables)
        primary: {
          50: 'rgb(var(--color-primary-400) / 0.1)',
          100: 'rgb(var(--color-primary-400) / 0.2)',
          200: 'rgb(var(--color-primary-400) / 0.3)',
          300: 'rgb(var(--color-primary-400) / 0.4)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)', // Main primary
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-600) / 0.8)',
          900: 'rgb(var(--color-primary-700) / 0.9)',
        },
        // Semantic tokens (themeable via CSS variables in src/index.css)
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
