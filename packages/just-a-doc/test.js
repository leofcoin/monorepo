import parse from './dist/index.js'

parse({
  input: ['./*.js', '!test.js', '!rollup.config.js', '!tsconfig.js'],
  output: 'docs',
  readme: './README.md'
})