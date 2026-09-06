import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { readdir, unlink } from 'fs/promises'
import postcss from 'rollup-plugin-postcss'
import postcssUrl from 'postcss-url'
import { join, relative } from 'path'
import fs from 'fs-extra'

const rootNodeModules = join(process.cwd(), '..', '..', 'node_modules')

try {
  const files = await readdir('www/monaco')
  await Promise.all(
    files
      .filter((file) => file.endsWith('.js') || file.endsWith('.LICENSE.txt'))
      .map((file) => unlink(join('www/monaco', file)))
  )
} catch {}

export default [
  {
    input: ['./src/monaco-loader.ts'],
    output: [
      {
        format: 'es',
        dir: 'www/monaco'
      }
    ],
    plugins: [
      json(),
      postcss({
        plugins: [
          postcssUrl({
            url: (asset) => {
              if (!/\.ttf$/.test(asset.url)) return asset.url
              const distPath = join(process.cwd(), 'www')
              const distFontsPath = join(distPath, 'fonts')
              fs.ensureDirSync(distFontsPath)
              const targetFontPath = join(distFontsPath, asset.pathname)
              fs.copySync(asset.absolutePath, targetFontPath)
              const relativePath = relative(process.cwd(), targetFontPath)
              const publicPath = './'
              console.log(relativePath)
              return `${publicPath}${relativePath.replace('www/', '')}`
            }
          })
        ]
      }),

      nodeResolve({
        mainFields: ['exports', 'browser:module', 'browser', 'module', 'main'],
        extensions: ['.mjs', '.cjs', '.js', '.json']
      }),
      commonjs()
    ]
  },
  {
    input: [join(rootNodeModules, 'monaco-editor', 'esm', 'vs', 'language', 'typescript', 'ts.worker.js')],
    output: [
      {
        format: 'iife',
        dir: 'www/monaco',
        name: 'tsWorker'
      }
    ]
  },
  {
    input: [join(rootNodeModules, 'monaco-editor', 'esm', 'vs', 'editor', 'editor.worker.js')],
    output: [
      {
        format: 'iife',
        name: 'editorWorker',
        dir: 'www/monaco'
      }
    ]
  }
]
