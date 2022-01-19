import json from  '@rollup/plugin-json'
import { execSync } from 'child_process'

execSync('rm -rf www/*.js')
execSync('cp -rf ./../addresses/addresses/**.js www/addresses')


export default [
	{
		input: ['src/shell.js', 'src/views/market.js', 'src/views/collections.js', 'src/views/wallet.js', 'src/views/account.js', 'src/views/auctions.js', 'src/views/create.js', 'src/views/listing.js', 'src/views/list.js', 'src/views/home.js', 'src/views/countdown.js', 'src/api/api.js'],
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
	}, {
		input: 'src/sw.js',
		plugins: [json()],
		output: {
			dir: 'www',
			format: 'cjs'
		}
	}, {
		input: 'src/sw-loader.js',
		plugins: [json()],
		output: {
			dir: 'www',
			format: 'cjs'
		}
	}
];
