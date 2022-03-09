import json from  '@rollup/plugin-json'
import { execSync } from 'child_process'


export default [{
		input: ['./src/lottery-master', './src/service.js'],
		plugins: [json()],
		output: {
			dir: 'dist',
			format: 'cjs'
		}
	}
];
