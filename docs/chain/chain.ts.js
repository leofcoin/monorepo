export default [
	{
		"start": 29,
		"end": 29,
		"value": "[]",
		"code": {
			"value": "#validators = []"
		},
		"params": [],
		"examples": [],
		"links": [],
		"type": "property",
		"private": true,
		"name": "#validators",
		"description": "[]"
	},
	{
		"start": 32,
		"end": 32,
		"value": "false",
		"code": {
			"value": "#runningEpoch = false"
		},
		"params": [],
		"examples": [],
		"links": [],
		"type": "property",
		"private": true,
		"name": "#runningEpoch",
		"description": "false"
	},
	{
		"start": 502,
		"end": 506,
		"value": "/**\n* every tx done is trough contracts so no need for amount\n* data is undefined when nothing is returned\n* error is thrown on error so undefined data doesn't mean there is an error...\n**/",
		"code": {
			"value": "async sendTransaction(transaction) {}"
		},
		"params": [],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async sendTransaction",
		"private": false,
		"description": "/**\n* every tx done is trough contracts so no need for amount\n* data is undefined when nothing is returned\n* error is thrown on error so undefined data doesn't mean there is an error...\n**/"
	},
	{
		"start": 526,
		"end": 530,
		"value": "/**\n*\n* @param {Address} sender\n* @returns {globalMessage}\n*/",
		"code": {
			"value": "#createMessage(sender = globalThis.peernet.selectedAccount) {}"
		},
		"params": [
			{
				"name": "sender",
				"value": "{Address} sender",
				"type": "Address"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "#createMessage",
		"private": true,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s {globalMessage}",
			"type": "globalMessage",
			"description": ""
		}
	},
	{
		"start": 539,
		"end": 546,
		"value": "/**\n*\n* @param {Address} sender\n* @param {Address} contract\n* @param {String} method\n* @param {Array} parameters\n* @returns\n*/",
		"code": {
			"value": "internalCall(sender: Address, contract: Address, method: string, parameters?: any[]) {}"
		},
		"params": [
			{
				"name": "sender",
				"value": "{Address} sender",
				"type": "Address"
			},
			{
				"name": "contract",
				"value": "{Address} contract",
				"type": "Address"
			},
			{
				"name": "method",
				"value": "{String} method",
				"type": "String"
			},
			{
				"name": "parameters",
				"value": "{Array} parameters",
				"type": "Array"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "internalCall",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s",
			"type": "__unsuported",
			"description": ""
		}
	},
	{
		"start": 553,
		"end": 559,
		"value": "/**\n*\n* @param {Address} contract\n* @param {String} method\n* @param {Array} parameters\n* @returns\n*/",
		"code": {
			"value": "call(contract: Address, method: string, parameters?: any[]) {}"
		},
		"params": [
			{
				"name": "contract",
				"value": "{Address} contract",
				"type": "Address"
			},
			{
				"name": "method",
				"value": "{String} method",
				"type": "String"
			},
			{
				"name": "parameters",
				"value": "{Array} parameters",
				"type": "Array"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "call",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s",
			"type": "__unsuported",
			"description": ""
		}
	},
	{
		"start": 591,
		"end": 599,
		"value": "/**\n* lookup an address for a registered name using the builtin nameService\n* @check nameService\n*\n* @param {String} - contractName\n* @returns {String} - address\n*\n* @example chain.lookup('myCoolContractName') // qmqsfddfdgfg...\n*/",
		"code": {
			"value": "lookup(name): Promise<{ owner; address }> {}"
		},
		"params": [
			{
				"name": "-",
				"value": "{String} - contractName",
				"type": "String",
				"description": "contractName"
			}
		],
		"examples": [],
		"links": [],
		"description": "/**\n* lookup an address for a registered name using the builtin nameService\n* ",
		"return": {
			"name": "s",
			"value": "s {String} - address",
			"type": "String",
			"description": "- address"
		}
	}
]