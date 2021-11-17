export default [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "artOnlineAccess_",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor",
		"signature": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"name": "Blacklist",
		"type": "event",
		"signature": "0xf7e58a63a036e3a7ef7921f83b6ae47930cf5c293dd3bfe7a857c6863409046d"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "artOnlineAccess_",
				"type": "address"
			}
		],
		"name": "setArtOnlineAccess",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xb60d3f9f"
	},
	{
		"inputs": [],
		"name": "artOnlineAccess",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0xda86b6e1"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "blacklist_",
				"type": "bool"
			}
		],
		"name": "blacklist",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function",
		"signature": "0x404e5129"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "blacklisted",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function",
		"constant": true,
		"signature": "0xdbac26e9"
	}
]