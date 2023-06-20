export default [
	{
		"start": 1,
		"end": 3,
		"value": "/**\n*\n*/",
		"code": {
			"value": "export default class SomeClass {}"
		},
		"params": [],
		"examples": [],
		"links": [],
		"type": "class",
		"name": " SomeClass ",
		"description": "/**\n*\n*/"
	},
	{
		"start": 5,
		"end": 7,
		"value": "0",
		"code": {
			"value": "#token = 0"
		},
		"params": [
			{
				"name": "",
				"value": "{Number}",
				"type": "Number"
			}
		],
		"examples": [],
		"links": [],
		"type": "property",
		"private": true,
		"name": "#token",
		"description": "0"
	},
	{
		"start": 10,
		"end": 16,
		"value": "/**\n* @example `someClass.someFunction('someString')`\n* @param {string} someParam description\n* @link [my-link](https://somelink.link)\n* @return {string} someString description\n*\n*/",
		"code": {
			"value": "someFunction(someParam) {}"
		},
		"params": [
			{
				"name": "someParam",
				"value": "{string} someParam description",
				"type": "string",
				"description": "description"
			}
		],
		"examples": [
			{
				"name": "example",
				"value": "someClass.someFunction('someString')"
			}
		],
		"links": [
			{
				"name": "my-link",
				"url": "https://somelink.link"
			}
		],
		"type": "method",
		"name": "someFunction",
		"private": false,
		"description": "/**\n* ",
		"return": {
			"name": "someString",
			"value": "{string} someString description",
			"type": "string",
			"description": "description"
		}
	}
]