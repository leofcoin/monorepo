# doc-it
> simple js comment parser
## usage
```js
import docIt from '@vandeurenglenn/doc-it'

docIt({input: './testClass.js', output: 'docs'})
```
### input
```js
export default class SomeClass {
  /** 
   * @param {Number}
   */
  #token = 0

  /**
   * @example `someClass.someFunction('someString')`
   * @param {string} someParam description 
   * @link [my-link](https://somelink.link)
   * @return {string} someString description
   * 
   */
  someFunction(someParam) {
    return someString
  }
}
  
```

### output
```js
export default [
	{
		"start": 2,
		"end": 4,
		"value": "/**\n* @param {Number}\n*/",
		"code": {
			"value": "#token = 0"
		},
		"params": [
			{
				"name": "",
				"value": "{Number}",
				"type": "Number",
				"description": ""
			}
		],
		"examples": [],
		"links": [],
		"properties": [
			{
				"name": "#token",
				"value": "0",
				"isPrivate": true
			}
		]
	},
	{
		"start": 7,
		"end": 13,
		"value": "/**\n* @example `someClass.someFunction('someString')`\n* @param {string} someParam description\n* @link [my-link](https://somelink.link)\n* @return {string} someString description\n*\n*/",
		"code": {
			"value": "someFunction(someParam) {}"
		},
		"params": [
			{
				"name": "someParam",
				"value": "{string} someParam description",
				"type": "string",
				"description": "someParam description"
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
		"properties": [],
		"type": "method",
		"name": "someFunction",
		"return": {
			"name": "someString",
			"value": "{string} someString description",
			"type": "string",
			"description": "description"
		}
	}
]
```