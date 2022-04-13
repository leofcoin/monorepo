import api from './api.js'
import SocketServer from './../../node_modules/socket-request-server/src/index'

export default class Server {
  constructor(port, identifiers = ['peernet-v0.1.0']) {
    if (!Array.isArray(identifiers)) identifiers = [identifiers]

    this.socketserver = SocketServer({port: 4400, protocol: identifiers[0]}, api)
  }
}
