import { execSync } from 'child_process'

execSync('rm -rf www/*.js')

export default [
	{
		input: ['src/shell.js', 'src/sections/vision.js', 'src/sections/features.js', 'src/sections/burning.js', 'src/sections/resources.js'],
		output: {
			dir: 'www',
			format: 'es',
			sourcemap: false
		},
		external: [
			'./third-party/ethers.js'
		]
	}
];
