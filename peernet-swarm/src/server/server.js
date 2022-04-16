import { broadcastPubSubMessage, sendPubSubMessage } from './utils.js'
import SocketServer from './../../node_modules/socket-request-server/src/index'

const peers = {}

const cleanupJob = () => setTimeout(() => {
  // loop trough know connections and check if they still connected
  for (const [id, connection] of Object.entries(peers)) {
    if (connection.connected === false) {
      delete peers[id]
      broadcastPubSubMessage('peer:left', id, peers)
    }
  }
  cleanupJob()
}, 1000);

cleanupJob()

/**
 * @params {String} id - id of the peer joined
 */
const peerJoined = id => {
  // cleanup leftover connection (sometimes peers don't have the time to send leave message...)
  delete peers[id]
  // tell everyone a peer joined
  broadcastPubSubMessage('peer:joined', id, peers)
}

/**
 * @params {String} id - id of the peer left
 */
const peerLeft = id => {
  // remove connection from peers
  delete peers[id]
  // tell everyone a peer left
  broadcastPubSubMessage('peer:left', id, peers)
}

export default class Server {
  constructor(port, identifiers = ['peernet-v0.1.0']) {
    if (!Array.isArray(identifiers)) identifiers = [identifiers]
    this.socketserver = SocketServer({port: 4400, protocol: identifiers[0]}, {
      peernet: (params, response) => {
        // peer left

        if (!params.join) return peerLeft(params.id)

        peerJoined(params.id)
        peers[params.id] = response.connection
        response.send(Object.keys(peers))
      }, signal: (params, response) => {
console.log(params);
        if (params.to) {
          sendPubSubMessage('signal', params, peers[params.to])
          // sendPubSubMessage('signal', params, peers[params.from])
        } else {
          broadcastPubSubMessage('signal', params, peers)
        }
      }
    })
    console.log(this.socketserver.socketRequestServer);
    pubsub.subscribe('signal', message => {

    })
  }
}
