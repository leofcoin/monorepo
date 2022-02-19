import json from  '@rollup/plugin-json'
import { execSync } from 'child_process'

execSync('rm -rf www/*.js')
execSync('cp -rf ./../addresses/addresses/**.js www/addresses')


export default [
	{
		input: ['src/shell.js', 'src/views/home.js'],
		output: {
			dir: 'www',
			format: 'es',
			sourcemap: false
		},
		plugins: [json()],
		external: [
			'./api.js',
			'./third-party/ethers.js',
			'./third-party/WalletConnectClient.js'
		]
	},
	{
		input: ['src/themes/default.js', 'src/themes/dark.js'],
		output: {
			dir: 'www/themes',
			format: 'es'
		}
	}
];
