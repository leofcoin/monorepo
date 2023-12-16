export default [
	{
		"start": 6,
		"end": 8,
		"value": "/**\n* @extends {Transaction}\n*/",
		"code": {
			"value": "export default class Contract extends Transaction {}"
		},
		"params": [],
		"examples": [],
		"links": [],
		"type": "class",
		"name": " Contract extends Transaction ",
		"description": "/**\n* "
	},
	{
		"start": 16,
		"end": 22,
		"value": "/**\n*\n* @param {Address} creator\n* @param {String} contract\n* @param {Array} constructorParameters\n* @returns lib.createContractMessage\n*/",
		"code": {
			"value": "async createContractMessage(creator, contract, constructorParameters = []) {}"
		},
		"params": [
			{
				"name": "creator",
				"value": "{Address} creator",
				"type": "Address"
			},
			{
				"name": "contract",
				"value": "{String} contract",
				"type": "String"
			},
			{
				"name": "constructorParameters",
				"value": "{Array} constructorParameters",
				"type": "Array"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async createContractMessage",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s lib.createContractMessage",
			"type": "__unsuported",
			"description": "lib.createContractMessage"
		}
	},
	{
		"start": 27,
		"end": 33,
		"value": "/**\n*\n* @param {Address} creator\n* @param {String} contract\n* @param {Array} constructorParameters\n* @returns {Address}\n*/",
		"code": {
			"value": "async createContractAddress(creator, contract, constructorParameters = []) {}"
		},
		"params": [
			{
				"name": "creator",
				"value": "{Address} creator",
				"type": "Address"
			},
			{
				"name": "contract",
				"value": "{String} contract",
				"type": "String"
			},
			{
				"name": "constructorParameters",
				"value": "{Array} constructorParameters",
				"type": "Array"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async createContractAddress",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s {Address}",
			"type": "Address",
			"description": ""
		}
	},
	{
		"start": 39,
		"end": 44,
		"value": "/**\n*\n* @param {String} contract\n* @param {Array} parameters\n* @returns\n*/",
		"code": {
			"value": "async deployContract(signer: MultiWallet, contract, constructorParameters = []) {}"
		},
		"params": [
			{
				"name": "contract",
				"value": "{String} contract",
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
		"name": "async deployContract",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s",
			"type": "__unsuported",
			"description": ""
		}
	}
]