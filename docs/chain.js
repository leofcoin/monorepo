export default [
	{
		"start": 631,
		"end": 641,
		"value": "/**\n* whenever method = createContract params should hold the contract hash\n*\n* example: [hash]\n* createTransaction('0x0', 'createContract', [hash])\n*\n* @param {String} to - the contract address for the contract to interact with\n* @param {String} method - the method/function to run\n* @param {Array} params - array of paramters to apply to the contract method\n* @param {Number} nonce - total transaction count [optional]\n*/",
		"code": {
			"value": "async createTransaction(to, method, parameters, nonce, signature) {}"
		},
		"params": [
			{
				"name": "to",
				"value": "{String} to - the contract address for the contract to interact with",
				"type": "String",
				"description": "-"
			},
			{
				"name": "method",
				"value": "{String} method - the method/function to run",
				"type": "String",
				"description": "-"
			},
			{
				"name": "params",
				"value": "{Array} params - array of paramters to apply to the contract method",
				"type": "Array",
				"description": "-"
			},
			{
				"name": "nonce",
				"value": "{Number} nonce - total transaction count [optional]",
				"type": "Number",
				"description": "-"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async createTransaction",
		"private": false,
		"description": "/**\n* whenever method = createContract params should hold the contract hash\n*\n* example: [hash]\n* createTransaction('0x0', 'createContract', [hash])\n*\n* "
	},
	{
		"start": 648,
		"end": 657,
		"value": "/**\n*\n* @param {Object} transaction {}\n* @param {String} transaction.from address\n* @param {String} transaction.to address\n* @param {Object} transaction.params {}\n* @param {String} transaction.params.method get, call\n* @param {Buffer} transaction.params.data\n* @returns\n*/",
		"code": {
			"value": "async createTransactionHash(transaction) {}"
		},
		"params": [
			{
				"name": "",
				"value": "{Object} transaction {}",
				"type": "Object transaction "
			},
			{
				"name": "transaction.from",
				"value": "{String} transaction.from address",
				"type": "String",
				"description": "address"
			},
			{
				"name": "transaction.to",
				"value": "{String} transaction.to address",
				"type": "String",
				"description": "address"
			},
			{
				"name": "",
				"value": "{Object} transaction.params {}",
				"type": "Object transaction.params "
			},
			{
				"name": "transaction.params.method",
				"value": "{String} transaction.params.method get, call",
				"type": "String",
				"description": "get,"
			},
			{
				"name": "transaction.params.data",
				"value": "{Buffer} transaction.params.data",
				"type": "Buffer"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async createTransactionHash",
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
		"start": 664,
		"end": 667,
		"value": "/**\n* @params {object} transaction -\n* @params {object} wallet - any wallet/signer that supports sign(RAWtransaction)\n*/",
		"code": {
			"value": "async #signTransaction (transaction, wallet) {}"
		},
		"params": [
			{
				"name": "s",
				"value": "s {object} transaction -",
				"type": "object",
				"description": ""
			},
			{
				"name": "s",
				"value": "s {object} wallet - any wallet/signer that supports sign(RAWtransaction)",
				"type": "object",
				"description": ""
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async #signTransaction ",
		"private": false,
		"description": "/**\n* "
	},
	{
		"start": 683,
		"end": 693,
		"value": "/**\n*\n* @param {Object} transaction\n* @param {Address} transaction.from\n* @param {Address} transaction.to\n* @param {String} transaction.method\n* @param {Array} transaction.params\n* @param {Number} transaction.nonce\n*\n* @returns {Object} transaction\n*/",
		"code": {
			"value": "async createRawTransaction(transaction) {}"
		},
		"params": [
			{
				"name": "transaction",
				"value": "{Object} transaction",
				"type": "Object"
			},
			{
				"name": "transaction.from",
				"value": "{Address} transaction.from",
				"type": "Address"
			},
			{
				"name": "transaction.to",
				"value": "{Address} transaction.to",
				"type": "Address"
			},
			{
				"name": "transaction.method",
				"value": "{String} transaction.method",
				"type": "String"
			},
			{
				"name": "transaction.params",
				"value": "{Array} transaction.params",
				"type": "Array"
			},
			{
				"name": "transaction.nonce",
				"value": "{Number} transaction.nonce",
				"type": "Number"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async createRawTransaction",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s {Object} transaction",
			"type": "Object",
			"description": "transaction"
		}
	},
	{
		"start": 708,
		"end": 718,
		"value": "/**\n* every tx done is trough contracts so no need for amount\n* data is undefined when nothing is returned\n* error is thrown on error so undefined data doesn't mean there is an error...\n*\n* @param {String} from - the sender address\n* @param {String} to - the contract address for the contract to interact with\n* @param {String} method - the method/function to run\n* @param {Array} params - array of paramters to apply to the contract method\n* @param {Number} nonce - total transaction count [optional]\n*/",
		"code": {
			"value": "async createTransactionFrom(from, to, method, parameters, nonce) {}"
		},
		"params": [
			{
				"name": "from",
				"value": "{String} from - the sender address",
				"type": "String",
				"description": "-"
			},
			{
				"name": "to",
				"value": "{String} to - the contract address for the contract to interact with",
				"type": "String",
				"description": "-"
			},
			{
				"name": "method",
				"value": "{String} method - the method/function to run",
				"type": "String",
				"description": "-"
			},
			{
				"name": "params",
				"value": "{Array} params - array of paramters to apply to the contract method",
				"type": "Array",
				"description": "-"
			},
			{
				"name": "nonce",
				"value": "{Number} nonce - total transaction count [optional]",
				"type": "Number",
				"description": "-"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async createTransactionFrom",
		"private": false,
		"description": "/**\n* every tx done is trough contracts so no need for amount\n* data is undefined when nothing is returned\n* error is thrown on error so undefined data doesn't mean there is an error...\n*\n* "
	},
	{
		"start": 766,
		"end": 771,
		"value": "[]) {}",
		"code": {
			"value": "async deployContract(contract, constructorParameters = []) {}"
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
		"type": "property",
		"private": false,
		"name": "async deployContract(contract, constructorParameters",
		"description": "[]) {}",
		"return": {
			"name": "s",
			"value": "s",
			"type": "__unsuported",
			"description": ""
		}
	},
	{
		"start": 841,
		"end": 849,
		"value": "/**\n* lookup an address for a registered name using the builtin nameService\n* @check nameService\n*\n* @param {String} - contractName\n* @returns {String} - address\n*\n* @example chain.lookup('myCoolContractName') // qmqsfddfdgfg...\n*/",
		"code": {
			"value": "lookup(name) {}"
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
		"type": "method",
		"name": "lookup",
		"private": false,
		"description": "/**\n* lookup an address for a registered name using the builtin nameService\n* ",
		"return": {
			"name": "s",
			"value": "s {String} - address",
			"type": "String",
			"description": "- address"
		}
	}
]