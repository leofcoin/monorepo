export default [
	{
		"start": 73,
		"end": 77,
		"value": "if (line.includes('/**')) {\nopen = true\nstart = lineIndex\nvalue += `${line.trim()}\\n`\nif (line.includes('*/')) {",
		"code": {
			"value": "tokens.push({ start, end: lineIndex, value: value.trim() })}"
		},
		"params": [],
		"examples": [],
		"links": [],
		"description": "if (line.includes('/**')) {\nopen = true\nstart = lineIndex\nvalue += `${line.trim()}\\n`\nif (line.includes('*/')) {"
	},
	{
		"start": 0,
		"end": 83,
		"value": "",
		"code": {
			"value": "tokens.push({ start, end: lineIndex, value: value.trim() })}"
		},
		"params": [],
		"examples": [],
		"links": [],
		"description": ""
	},
	{
		"start": 215,
		"end": 218,
		"value": "/**\n* @param {object} options\n* @param {string} options.input\n*/",
		"code": {
			"value": "export default async ({ input, output, readme, monorepo }: Options) => {}"
		},
		"params": [
			{
				"name": "options",
				"value": "{object} options",
				"type": "object"
			},
			{
				"name": "options.input",
				"value": "{string} options.input",
				"type": "string"
			}
		],
		"examples": [],
		"links": [],
		"type": "arrowFuction",
		"name": "{ input, output, readme, monorepo }: Options) => {}",
		"description": "/**\n* "
	}
]