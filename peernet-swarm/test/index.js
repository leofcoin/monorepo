const Client = require('./../dist/commonjs/client');
const Server = require('./../dist/commonjs/server');

globalThis.DEBUG = true
const server = new Server().then(() => new Client())
