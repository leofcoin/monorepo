import modify from 'rollup-plugin-modify';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import rimraf from 'rimraf';
import nodeResolve from '@rollup/plugin-node-resolve';
import tsconfig from './tsconfig.json' assert { type: 'json'};

try {
  rimraf('./exports/**/*')
} catch (e) {
  console.log('nothing to clean');
};

export default  [{
  input: ['src/index.ts', 'src/server/server.ts', 'src/client/client.ts'],
  output: [{
    dir: './exports',
    format: 'es'
  }],
  external: [
    './simple-peer.js'
  ],
  plugins: [
    commonjs({exclude: ['./simple-peer.js']}),
    typescript(tsconfig)
  ]
}, {
  input: ['src/client/client.ts'],
  external: [
    './simple-peer.js'
  ],
  output: [{
    dir: './exports/browser',
    format: 'es'
  }],
  plugins: [
    json(),
    commonjs(),
    nodeResolve({mainFields: ['browser', 'module']}),
    typescript({...tsconfig, compilerOptions: {
      declaration: false,
      outDir: './exports/browser'
    }})
  ]
}]
