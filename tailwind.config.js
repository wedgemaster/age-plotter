/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/age_plotter/templates/**/*.html',
    './src/age_plotter/static/js/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
      'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween',
      'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
      'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn',
      'business', 'acid', 'lemonade', 'night', 'coffee', 'winter',
      'dim', 'nord', 'sunset'
    ],
    darkTheme: 'dark',
  },
}
