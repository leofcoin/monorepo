import socketResponse from './../../node_modules/socket-request-server/src/socket-response'

const peers = {}
/**
 * @params {String} event - name of the pubsub.subscribtion (peer:left||peer:joined)
 * @params {String} id - peer id
 */
const sendPubSubMessage = (event, id) => {
  for (const connection of Object.values(peers)) {
    socketResponse(connection, 'pubsub', event).send(id)
  }
}

const cleanupJob = () => setTimeout(() => {
  // loop trough know connections and check if they still connected
  for (const [id, connection] of Object.entries(peers)) {
    if (connection.connected === false) {
      delete peers[id]
      sendPubSubMessage('peer:left', id)
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
  sendPubSubMessage('peer:joined', id)
}

/**
 * @params {String} id - id of the peer left
 */
const peerLeft = id => {
  // remove connection from peers
  delete peers[id]
  // tell everyone a peer left
  sendPubSubMessage('peer:left', id)
}

export default {
  peernet: (params, response) => {
    // peer left
    if (!params.join) return peerLeft(params.id)

    peerJoined(params.id)
    peers[params.id] = response.connection
    response.send(Object.keys(peers))
  }
}
