const nodeResolve = require('@rollup/plugin-node-resolve').default;
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const json = require('@rollup/plugin-json');
const { terser } = require('rollup-plugin-terser');

module.exports = {
  input: 'src/sidebar-card.ts',
  output: {
    file: 'dist/sidebar-card.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    typescript({
      sourceMap: false,
      declaration: false,
    }),
    nodeResolve({
      browser: true,
      dedupe: ['lit-element', 'lit-html'],
    }),
    commonjs(),
    json(),
    terser({
      format: {
        comments: false,
      },
    }),
  ],
};
