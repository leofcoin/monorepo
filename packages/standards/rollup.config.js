import typescript from '@rollup/plugin-typescript'
import { execSync } from 'child_process'
import autoExports from 'rollup-plugin-auto-exports'

// const templates = (await readdir('./src/templates')).map(path => join('./src/templates', path))
const clean = () => {
  execSync('rm -rf www/*.js')
  return
}

export default [
  {
    input: [
      'src/index.ts',
      'src/meta.ts',
      'src/token.ts',
      'src/roles.ts',
      'src/voting/public-voting.ts',
      'src/voting/interfaces/i-public-voting.ts',
      'src/voting/private-voting.ts',
      'src/helpers.ts',
      'src/token-receiver.ts'
    ],
    output: {
      dir: './exports',
      format: 'es'
    },
    plugins: [
      typescript(),
      autoExports({
        exportsDir: 'exports',
        defaultExports: {
          '.': {
            import: 'exports/index.js',
            types: 'exports/index.d.ts'
          }
        }
      })
    ]
  }
]
