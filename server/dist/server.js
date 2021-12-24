'use strict';

var Koa = require('koa');
var ethers = require('ethers');
var fetch = require('node-fetch');
var mime = require('mime-types');
var Router = require('@koa/router');
var cors = require('@koa/cors');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Koa__default = /*#__PURE__*/_interopDefaultLegacy(Koa);
var ethers__default = /*#__PURE__*/_interopDefaultLegacy(ethers);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch);
var mime__default = /*#__PURE__*/_interopDefaultLegacy(mime);
var Router__default = /*#__PURE__*/_interopDefaultLegacy(Router);
var cors__default = /*#__PURE__*/_interopDefaultLegacy(cors);

var addresses = {
  "access": "0x94097a3370Bc989525EDe428cC65531BF938770B",
  "bridger": "0xfEDd5754a73aef381f9bab7a63DaB90e69046314",
  "mining": "0x90155c15F4e42040343A81Aaf8709A716144B430",
  "blacklist": "0x50dAFC1F2401E36EcAED44Ef2816cad5959Ac9Dd",
  "artonline": "0x977D136BA4e4A8a68Ec8A4E406DaC7Da291AdFdd",
  "platform": "0xaE733fe860dC149fAA5208E4EF2D36592AB8a632",
  "exchange": "0xd01C823Aacb35f5eF302d914E8cDEfBf77cB4618",
  "exchangeFactory": "0xBFF5f9843C0a924a5897d89384fcFcb21dCdb71a",
  "staking": "0x6523e0376901fc072e905045C722Cae2176636BA",
  "native": "0xae13d989dac2f0debff460ac112a837c89baa7cd",
  "panCakeRouter": "0x9ac64cc6e4415144c455bd8e4837fea55603e5c3",
  "multiCall": "0xae11c5b5f29a6a25e955f0cb8ddcc416f522af5c",
  "partnershipToken": "0x37292f1a9890FE17a037B9Ad3EF25397703C1B82",
  "splitter": "0xDb9C4643B289B73f4cC9e82EE6f6d9CEceFDBF5b",
  "partnerPool": "0xB9A3889C4f906268cCa013d196e53b5eD990a96E"
};

var abi$4 = [
	{
		inputs: [
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "Listed",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "oldOwner",
				type: "address"
			},
			{
				indexed: false,
				internalType: "address",
				name: "newOwner",
				type: "address"
			}
		],
		name: "OwnerChange",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "oldPrice",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "newPrice",
				type: "uint256"
			}
		],
		name: "PriceChange",
		type: "event"
	},
	{
		inputs: [
		],
		name: "contractAddress",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "currency",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "delist",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "factory",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "isListed",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "list",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "listed",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes"
			}
		],
		name: "onERC721Received",
		outputs: [
			{
				internalType: "bytes4",
				name: "",
				type: "bytes4"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "owner",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "price",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "currency_",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "price_",
				type: "uint256"
			}
		],
		name: "setCurrency",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner_",
				type: "address"
			}
		],
		name: "setOwner",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "setPrice",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "splitter_",
				type: "address"
			}
		],
		name: "setSplitter",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "splitter",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "tokenId",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			}
		],
		name: "buy",
		outputs: [
		],
		stateMutability: "payable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner_",
				type: "address"
			},
			{
				internalType: "address",
				name: "contractAddress_",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId_",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "price_",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "currency_",
				type: "address"
			}
		],
		name: "initialize",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner_",
				type: "address"
			},
			{
				internalType: "address",
				name: "contractAddress_",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "id_",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "tokenId_",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "price_",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "currency_",
				type: "address"
			}
		],
		name: "initialize",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "id",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "id_",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "value",
				type: "uint256"
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes"
			}
		],
		name: "onERC1155Received",
		outputs: [
			{
				internalType: "bytes4",
				name: "",
				type: "bytes4"
			}
		],
		stateMutability: "pure",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "uint256[]",
				name: "ids",
				type: "uint256[]"
			},
			{
				internalType: "uint256[]",
				name: "values",
				type: "uint256[]"
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes"
			}
		],
		name: "onERC1155BatchReceived",
		outputs: [
			{
				internalType: "bytes4",
				name: "",
				type: "bytes4"
			}
		],
		stateMutability: "pure",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes4",
				name: "interfaceId",
				type: "bytes4"
			}
		],
		name: "supportsInterface",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "pure",
		type: "function"
	}
];

var abi$3 = [
	{
		inputs: [
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "Listed",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "oldOwner",
				type: "address"
			},
			{
				indexed: false,
				internalType: "address",
				name: "newOwner",
				type: "address"
			}
		],
		name: "OwnerChange",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "uint256",
				name: "oldPrice",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "newPrice",
				type: "uint256"
			}
		],
		name: "PriceChange",
		type: "event"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			}
		],
		name: "buy",
		outputs: [
		],
		stateMutability: "payable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner_",
				type: "address"
			},
			{
				internalType: "address",
				name: "contractAddress_",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId_",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "price_",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "currency_",
				type: "address"
			}
		],
		name: "initialize",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "setPrice",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "price",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "isListed",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "listed",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "delist",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "list",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "factory",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "tokenId",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "owner",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner_",
				type: "address"
			}
		],
		name: "setOwner",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "currency",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "currency_",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "price_",
				type: "uint256"
			}
		],
		name: "setCurrency",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "splitter",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "splitter_",
				type: "address"
			}
		],
		name: "setSplitter",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "contractAddress",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes"
			}
		],
		name: "onERC721Received",
		outputs: [
			{
				internalType: "bytes4",
				name: "",
				type: "bytes4"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];

var abi$2 = [
	{
		inputs: [
			{
				internalType: "string",
				name: "name",
				type: "string"
			},
			{
				internalType: "string",
				name: "version",
				type: "string"
			}
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "listing",
				type: "address"
			}
		],
		name: "Delist",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "listing",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "List",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "listing",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "ListPartner",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "Paused",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			},
			{
				indexed: true,
				internalType: "bytes32",
				name: "previousAdminRole",
				type: "bytes32"
			},
			{
				indexed: true,
				internalType: "bytes32",
				name: "newAdminRole",
				type: "bytes32"
			}
		],
		name: "RoleAdminChanged",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			},
			{
				indexed: true,
				internalType: "address",
				name: "account",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "sender",
				type: "address"
			}
		],
		name: "RoleGranted",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			},
			{
				indexed: true,
				internalType: "address",
				name: "account",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "sender",
				type: "address"
			}
		],
		name: "RoleRevoked",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "listing",
				type: "address"
			}
		],
		name: "Sold",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "Unpaused",
		type: "event"
	},
	{
		inputs: [
		],
		name: "DEFAULT_ADMIN_ROLE",
		outputs: [
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "allListings",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "getListing",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "getListingERC1155",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			}
		],
		name: "getRoleAdmin",
		outputs: [
			{
				internalType: "bytes32",
				name: "",
				type: "bytes32"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			},
			{
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "grantRole",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			},
			{
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "hasRole",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "listings",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "listingsERC1155",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "paused",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			},
			{
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "renounceRole",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes32",
				name: "role",
				type: "bytes32"
			},
			{
				internalType: "address",
				name: "account",
				type: "address"
			}
		],
		name: "revokeRole",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "bytes4",
				name: "interfaceId",
				type: "bytes4"
			}
		],
		name: "supportsInterface",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "receiver",
				type: "address"
			}
		],
		name: "setFeeReceiver",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "feeReceiver",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "fee_",
				type: "uint256"
			}
		],
		name: "setFee",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
		],
		name: "fee",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "listingLength",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "listingERC1155Length",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "contractAddress",
				type: "address"
			},
			{
				internalType: "address",
				name: "currency",
				type: "address"
			},
			{
				internalType: "address",
				name: "splitter",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "price",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "id",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "createPartnerListing",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address[]",
				name: "contractAddresses",
				type: "address[]"
			},
			{
				internalType: "address[]",
				name: "currencies",
				type: "address[]"
			},
			{
				internalType: "address[]",
				name: "splitters",
				type: "address[]"
			},
			{
				internalType: "uint256[]",
				name: "prices",
				type: "uint256[]"
			},
			{
				internalType: "uint256[]",
				name: "ids",
				type: "uint256[]"
			},
			{
				internalType: "uint256[]",
				name: "tokenIds",
				type: "uint256[]"
			}
		],
		name: "createPartnerListingBatch",
		outputs: [
			{
				internalType: "address[]",
				name: "listings",
				type: "address[]"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address[]",
				name: "contractAddresses",
				type: "address[]"
			},
			{
				internalType: "address[]",
				name: "currencies",
				type: "address[]"
			},
			{
				internalType: "uint256[]",
				name: "prices",
				type: "uint256[]"
			},
			{
				internalType: "uint256[]",
				name: "ids",
				type: "uint256[]"
			},
			{
				internalType: "uint256[]",
				name: "tokenIds",
				type: "uint256[]"
			}
		],
		name: "createListingBatch",
		outputs: [
			{
				internalType: "address[]",
				name: "listings",
				type: "address[]"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "contractAddress",
				type: "address"
			},
			{
				internalType: "address",
				name: "currency",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "price",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "id",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "createListing",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "contractAddress",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "id",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "price",
				type: "uint256"
			},
			{
				internalType: "address",
				name: "currency",
				type: "address"
			}
		],
		name: "relist",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "contractAddress",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "id",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "buy",
		outputs: [
		],
		stateMutability: "payable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "listing",
				type: "address"
			},
			{
				internalType: "address",
				name: "splitter",
				type: "address"
			}
		],
		name: "setSplitter",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			}
		],
		name: "feeFor",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	}
];

var abi$1 = [
	{
		inputs: [
			{
				internalType: "string",
				name: "uri_",
				type: "string"
			}
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "account",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				indexed: false,
				internalType: "bool",
				name: "approved",
				type: "bool"
			}
		],
		name: "ApprovalForAll",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256[]",
				name: "ids",
				type: "uint256[]"
			},
			{
				indexed: false,
				internalType: "uint256[]",
				name: "values",
				type: "uint256[]"
			}
		],
		name: "TransferBatch",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "id",
				type: "uint256"
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "value",
				type: "uint256"
			}
		],
		name: "TransferSingle",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: "string",
				name: "value",
				type: "string"
			},
			{
				indexed: true,
				internalType: "uint256",
				name: "id",
				type: "uint256"
			}
		],
		name: "URI",
		type: "event"
	},
	{
		inputs: [
			{
				internalType: "bytes4",
				name: "interfaceId",
				type: "bytes4"
			}
		],
		name: "supportsInterface",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		name: "uri",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "account",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "id",
				type: "uint256"
			}
		],
		name: "balanceOf",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address[]",
				name: "accounts",
				type: "address[]"
			},
			{
				internalType: "uint256[]",
				name: "ids",
				type: "uint256[]"
			}
		],
		name: "balanceOfBatch",
		outputs: [
			{
				internalType: "uint256[]",
				name: "",
				type: "uint256[]"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "bool",
				name: "approved",
				type: "bool"
			}
		],
		name: "setApprovalForAll",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "account",
				type: "address"
			},
			{
				internalType: "address",
				name: "operator",
				type: "address"
			}
		],
		name: "isApprovedForAll",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "id",
				type: "uint256"
			},
			{
				internalType: "uint256",
				name: "amount",
				type: "uint256"
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes"
			}
		],
		name: "safeTransferFrom",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256[]",
				name: "ids",
				type: "uint256[]"
			},
			{
				internalType: "uint256[]",
				name: "amounts",
				type: "uint256[]"
			},
			{
				internalType: "bytes",
				name: "data",
				type: "bytes"
			}
		],
		name: "safeBatchTransferFrom",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];

var abi = [
	{
		inputs: [
			{
				internalType: "string",
				name: "name_",
				type: "string"
			},
			{
				internalType: "string",
				name: "symbol_",
				type: "string"
			}
		],
		stateMutability: "nonpayable",
		type: "constructor"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "approved",
				type: "address"
			},
			{
				indexed: true,
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "Approval",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				indexed: false,
				internalType: "bool",
				name: "approved",
				type: "bool"
			}
		],
		name: "ApprovalForAll",
		type: "event"
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				indexed: true,
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				indexed: true,
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "Transfer",
		type: "event"
	},
	{
		inputs: [
			{
				internalType: "bytes4",
				name: "interfaceId",
				type: "bytes4"
			}
		],
		name: "supportsInterface",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			}
		],
		name: "balanceOf",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "ownerOf",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "name",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
		],
		name: "symbol",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "tokenURI",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "approve",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "getApproved",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "operator",
				type: "address"
			},
			{
				internalType: "bool",
				name: "approved",
				type: "bool"
			}
		],
		name: "setApprovalForAll",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "owner",
				type: "address"
			},
			{
				internalType: "address",
				name: "operator",
				type: "address"
			}
		],
		name: "isApprovedForAll",
		outputs: [
			{
				internalType: "bool",
				name: "",
				type: "bool"
			}
		],
		stateMutability: "view",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "transferFrom",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			}
		],
		name: "safeTransferFrom",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	},
	{
		inputs: [
			{
				internalType: "address",
				name: "from",
				type: "address"
			},
			{
				internalType: "address",
				name: "to",
				type: "address"
			},
			{
				internalType: "uint256",
				name: "tokenId",
				type: "uint256"
			},
			{
				internalType: "bytes",
				name: "_data",
				type: "bytes"
			}
		],
		name: "safeTransferFrom",
		outputs: [
		],
		stateMutability: "nonpayable",
		type: "function"
	}
];

const cache$1 = {};

const getTime = () => {
  return Math.round(new Date().getTime() / 1000)
};

const timeout = () => {
  setTimeout(async () => {
    const start = getTime();
    let i;
    let done = false;
    for (var key of Object.keys(cache$1)) {
      i++;
      cache$1[key].job().then(() => {
        console.log(`job ${key} took ${getTime() - start}s`);
        if (i === Object.keys(cache$1) - 1) done = true;
      });
    }
    if (done) console.log(`jobs took ${getTime() - start}s`);
    timeout();
  }, 10 * 60 * 1000);
};

timeout();

const provider$1 = new ethers__default["default"].providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
});

const getMetadataURI = async (address, id, type) => {
  const contract = type === 'ERC1155' ?
                   new ethers__default["default"].Contract(address, abi$1, provider$1) :
                   new ethers__default["default"].Contract(address, abi, provider$1);

  const uri = type === 'ERC1155' ? await contract.callStatic.uri(id) : await contract.callStatic.tokenURI(id);
  return uri.replace(`{id}`, id)
};

const getJsonFor = async (address, id, type) => {
  if (!cache$1[`uri_${address}_${id}`]) {
    cache$1[`uri_${address}_${id}`] = {
      job: async () => cache$1[`uri_${address}_${id}`].value = await getMetadataURI(address, id, type)
    };
    cache$1[`uri_${address}_${id}`].value = await cache$1[`uri_${address}_${id}`].job();

  }

  const uri = cache$1[`uri_${address}_${id}`].value;
  const response = await fetch__default["default"](uri);
  return response.json()
};

const router$2 = new Router__default["default"]();

const twentyMinutes = 20 * 60 * 1000;
const start = new Date().getTime();
const done = start + twentyMinutes;

const provider = new ethers__default["default"].providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
});

const contract = new ethers__default["default"].Contract(addresses.exchangeFactory, abi$2, provider);

router$2.get('/', ctx => {
  ctx.body = 'v0.0.1-alpha';
});

router$2.get('/countdown', ctx => {
  const now = new Date().getTime();
  if (done < now) ctx.body = String(0);
  else {
    ctx.body = String(done - now);
  }
});

const sendJSON$1 = (ctx, value) => {
  ctx.type = mime__default["default"].lookup('json');
  ctx.body = JSON.stringify(value);
};

const listingListed = async (address) => {
  const listingContract = new ethers__default["default"].Contract(address, abi$3, provider);
  const listed = await listingContract.callStatic.listed();
  return listed.toNumber() === 1
};

router$2.get('/listings/ERC721', async ctx => {
  if (!cache$1.listingsERC721) {
    cache$1.listingsERC721 = {
      job: async () => {
        const listings = [];
        const listingsLength = await contract.listingLength();
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listingsERC721(i);
          if (!cache$1[`listed_${address}`]) {
            cache$1[`listed_${address}`] = {
              job: async () => cache$1[`listed_${address}`].value = await listingListed(address)
            };
          }
          listings.push({address, listed: cache$1[`listed_${address}`].value});
        }
        cache$1.listingsERC721.value = listings;
      }
    };
    await cache$1.listingsERC721.job();
  }
  sendJSON$1(ctx, cache$1.listingsERC721.value);
});

router$2.get('/listings/ERC1155', async ctx => {
  if (!cache$1.listingsERC1155) {
    cache$1.listingsERC1155 = {
      job: async () => {
        const listings = [];
        const listingsLength = await contract.listingERC1155Length();
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listingsERC1155(i);
          if (!cache$1[`listed_${address}`]) {
            cache$1[`listed_${address}`] = {
              job: async () => cache$1[`listed_${address}`].value = await listingListed(address)
            };
          }
          listings.push({address, listed: await listingListed(address)});
        }
        cache$1.listingsERC1155.value = listings;
      }
    };

    await cache$1.listingsERC1155.job();
  }
  sendJSON$1(ctx, cache$1.listingsERC1155.value);
});

router$2.get('/listings', async ctx => {

  if (!cache$1.listingsERC721) {
    const listings = [];
    cache$1['listingsERC721'] = {
      job: async () => {
        const listingsLength = await api.contract.listingERC721Length();
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listingsERC721(i);
          listings.push({address, listed: await listingListed(address)});
        }
        cache$1['listingsERC721'].value = listings;
      }
    };
    await cache$1['listingsERC721'].job();
  }

  if (!cache$1.listingsERC1155) {
    const listings = [];
    cache$1['listingsERC1155'] = {
      job: async () => {
        const listingsLength = await api.contract.listingERC1155Length();
        for (let i = 0; i < listingsLength; i++) {
          const address = await contract.callStatic.listingsERC1155(i);
          listings.push({address, listed: await listingListed(address)});
        }
        cache$1['listingERC1155'].value = listings;
      }
    };
    await cache$1['listingERC1155'].job();
  }
  sendJSON$1(ctx, {
    ERC1155: cache$1['listingERC1155'].value,
    ERC721: cache$1['listingERC721'].value
  });
});

router$2.get('/listing/info', async ctx => {
  const { address } = ctx.request.query;
  if (!cache$1[`listingInfo_${address}`]) {
    cache$1[`listingInfo_${address}`] = {
      job: async () => {
        const contract = new ethers__default["default"].Contract(address, abi$4, provider);
        let promises = [
          contract.callStatic.price(),
          contract.callStatic.id(),
          contract.callStatic.currency(),
          contract.callStatic.contractAddress(),
          listingListed(address)
        ];
        promises = await Promise.all(promises);
        let tokenId;
        let type = 'ERC721';
        try {
          tokenId = await contract.callStatic.tokenId();
          type = 'ERC1155';
        } catch (e) {

        }

        const json = await getJsonFor(promises[3], promises[1], type);
        const metadataURI = await getMetadataURI(promises[3], promises[1], type);
        cache$1[`listingInfo_${address}`].value = {
          price: ethers__default["default"].utils.formatUnits(promises[0], 18),
          id: promises[1].toString(),
          tokenId: tokenId.toString(),
          currency: promises[2],
          contractAddress: promises[3],
          listed: promises[4],
          metadataURI,
          json
        };
      }
    };
  }
  await cache$1[`listingInfo_${address}`].job();
  sendJSON$1(ctx, cache$1[`listingInfo_${address}`].value);
});

router$2.get('/listing/listed', async ctx => {
  console.log(ctx.request.query);
  const { address } = ctx.request.query;
  if (!cache$1[`listed_${address}`]) {
    cache$1[`listed_${address}`] = {
      job: async () => cache$1[`listed_${address}`].value = await listingListed(address)
    };
  }
  await cache$1[`listed_${address}`].job();
  ctx.body = cache$1[`listed_${address}`].value;
});

router$2.get('/listing/ERC721', async ctx => {
  const { address, tokenId } = ctx.params;
  const listing = cache[`${address}_${tokenId}`] || await contract.callStatic.getListingERC721(address, tokenId);
  sendJSON$1(ctx, listing);
});

router$2.get('/listing/ERC1155', async ctx => {
  const { address, id, tokenId } = ctx.params;
  const listing = cache[`${address}_${id}_${tokenId}`] || await contract.callStatic.getListingERC1155(address, id, tokenId);
  sendJSON$1(ctx, listing);
});

const router$1 = new Router__default["default"]();

router$1.get('/', ctx => {

});

router$1.get('/pools', ctx => {

});

const router = new Router__default["default"]();

router.get('/nft', ctx => {
  ctx.body = 'v0.0.1-alpha';
});

router.get('/nft/uri', async ctx => {
  const { address, id, type } = ctx.request.query;
  if (!cache$1[`uri_${address}_${id}`]) {
    cache$1[`uri_${address}_${id}`] = {
      job: async () => cache$1[`uri_${address}_${id}`].value = await getMetadataURI(address, id, type)
    };
    cache$1[`uri_${address}_${id}`].value = await cache$1[`uri_${address}_${id}`].job();
  }
  ctx.body = cache$1[`uri_${address}_${id}`].value;
});

router.get('/nft/json', async ctx => {
  const { address, id, type } = ctx.request.query;
  if (!cache$1[`json_${address}_${id}`]) {
    cache$1[`json_${address}_${id}`] = {
      job: async () => cache$1[`json_${address}_${id}`].value = await getJsonFor(address, id, type)
    };
    cache$1[`json_${address}_${id}`].value = await cache$1[`json_${address}_${id}`].job();
  }

  sendJSON(ctx, cache$1[`json_${address}_${id}`].value);
});

const server = new Koa__default["default"]();

server.use(cors__default["default"]({origin: '*'}));

server.use(router.routes());
server.use(router$2.routes());
server.use(router$1.routes());

server.listen(9044);
