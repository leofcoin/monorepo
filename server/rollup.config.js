import json from  '@rollup/plugin-json'
import { execSync } from 'child_process'


export default [{
		input: ['./src/server.js'],
		plugins: [json()],
		output: {
			dir: 'dist',
			format: 'cjs'
		}
	}
];
