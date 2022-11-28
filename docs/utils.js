export default [
	{
		"start": 3,
		"end": 7,
		"value": "/**\n* @params {String} event - name of the pubsub.subscribtion (peer:left||peer:joined)\n* @params {String} data - peer id\n* @params {String} connection - peer connection\n*/",
		"code": {
			"value": "export const sendPubSubMessage = (event, data, connection) => {}"
		},
		"params": [
			{
				"name": "s",
				"value": "s {String} event - name of the pubsub.subscribtion (peer:left||peer:joined)",
				"type": "String",
				"description": ""
			},
			{
				"name": "s",
				"value": "s {String} data - peer id",
				"type": "String",
				"description": ""
			},
			{
				"name": "s",
				"value": "s {String} connection - peer connection",
				"type": "String",
				"description": ""
			}
		],
		"examples": [],
		"links": [],
		"type": "arrowFuction",
		"name": " sendPubSubMessage = ",
		"description": "/**\n* "
	},
	{
		"start": 12,
		"end": 16,
		"value": "/**\n* @params {String} event - name of the pubsub.subscribtion (peer:left||peer:joined)\n* @params {String} data - peer id\n* @params {Object} peers - peerset to broadcast todo\n*/",
		"code": {
			"value": "export const broadcastPubSubMessage = (event, data, peers) => {}"
		},
		"params": [
			{
				"name": "s",
				"value": "s {String} event - name of the pubsub.subscribtion (peer:left||peer:joined)",
				"type": "String",
				"description": ""
			},
			{
				"name": "s",
				"value": "s {String} data - peer id",
				"type": "String",
				"description": ""
			},
			{
				"name": "s",
				"value": "s {Object} peers - peerset to broadcast todo",
				"type": "Object",
				"description": ""
			}
		],
		"examples": [],
		"links": [],
		"type": "arrowFuction",
		"name": " broadcastPubSubMessage = ",
		"description": "/**\n* "
	}
]