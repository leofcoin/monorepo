import docIt from '@vandeurenglenn/doc-it'

docIt({
  input: [
    './packages/*/src/**/*.{ts,js}'
  ],
  output: 'docs',
  readme: './readme.md'
})