export default [
	{
		"start": 20,
		"end": 25,
		"value": "/**\n* protocol version control!\n* note v1 and 1.1 delete everything because of big changes, this is not what we want in the future\n* in the future we want newer nodes to handle the new changes and still confirm old version transactions\n* unless there is a security issue!\n*/",
		"code": {
			"value": "if (this.version !== '1.1.1') {}"
		},
		"params": [],
		"examples": [],
		"links": [],
		"type": "method",
		"name": "if ",
		"private": false,
		"description": "/**\n* protocol version control!\n* note v1 and 1.1 delete everything because of big changes, this is not what we want in the future\n* in the future we want newer nodes to handle the new changes and still confirm old version transactions\n* unless there is a security issue!\n*/"
	}
]