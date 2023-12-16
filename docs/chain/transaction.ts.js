export default [
	{
		"start": 11,
		"end": 15,
		"value": "/**\n*\n* @param {Address[]} transactions\n* @returns transactions to include\n*/",
		"code": {
			"value": "async getTransactions(transactions) {}"
		},
		"params": [
			{
				"name": "transactions",
				"value": "{Address[]} transactions",
				"type": "Address[]"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async getTransactions",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s transactions to include",
			"type": "__unsuported",
			"description": "transactions to include"
		}
	},
	{
		"start": 38,
		"end": 42,
		"value": "/**\n*\n* @param {Transaction[]} transactions An array containing Transactions\n* @returns {TransactionMessage}\n*/",
		"code": {
			"value": "async promiseTransactions(transactions): Promise<TransactionMessage[]> {}"
		},
		"params": [
			{
				"name": "transactions",
				"value": "{Transaction[]} transactions An array containing Transactions",
				"type": "Transaction[]",
				"description": "An"
			}
		],
		"examples": [],
		"links": [],
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s {TransactionMessage}",
			"type": "TransactionMessage",
			"description": ""
		}
	},
	{
		"start": 48,
		"end": 52,
		"value": "/**\n*\n* @param {Transaction[]} transactions An array containing Transactions\n* @returns {Object} {transaction.decoded, transaction.hash}\n*/",
		"code": {
			"value": "async promiseTransactionsContent(transactions) {}"
		},
		"params": [
			{
				"name": "transactions",
				"value": "{Transaction[]} transactions An array containing Transactions",
				"type": "Transaction[]",
				"description": "An"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async promiseTransactionsContent",
		"private": false,
		"description": "/**\n*\n* ",
		"return": {
			"name": "s",
			"value": "s {Object} {transaction.decoded, transaction.hash}",
			"type": "Object transaction.decoded, transaction.hash",
			"description": ""
		}
	},
	{
		"start": 66,
		"end": 70,
		"value": "/**\n* When a nonce isn't found for an address fallback to just checking the transactionnPoolStore\n* @param {Address} address\n* @returns {Number} nonce\n*/",
		"code": {
			"value": "async #getNonceFallback(address) {}"
		},
		"params": [
			{
				"name": "address",
				"value": "{Address} address",
				"type": "Address"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async #getNonceFallback",
		"private": false,
		"description": "/**\n* When a nonce isn't found for an address fallback to just checking the transactionnPoolStore\n* ",
		"return": {
			"name": "s",
			"value": "s {Number} nonce",
			"type": "Number",
			"description": "nonce"
		}
	},
	{
		"start": 99,
		"end": 103,
		"value": "/**\n* Get amount of transactions by address\n* @param {Address} address The address to get the nonce for\n* @returns {Number} nonce\n*/",
		"code": {
			"value": "async getNonce(address) {}"
		},
		"params": [
			{
				"name": "address",
				"value": "{Address} address The address to get the nonce for",
				"type": "Address",
				"description": "The"
			}
		],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "async getNonce",
		"private": false,
		"description": "/**\n* Get amount of transactions by address\n* ",
		"return": {
			"name": "s",
			"value": "s {Number} nonce",
			"type": "Number",
			"description": "nonce"
		}
	}
]