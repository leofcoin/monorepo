import json from  '@rollup/plugin-json'
import { execSync } from 'child_process'

execSync('rm -rf www/*.js')


export default [
	{
		input: ['src/shell.js', 'src/views/home.js'],
		output: {
			dir: 'www',
			format: 'es',
			sourcemap: false
		},
		plugins: [json()],
	},
	{
		input: ['src/themes/default.js', 'src/themes/dark.js'],
		output: {
			dir: 'www/themes',
			format: 'es'
		}
	}
];
