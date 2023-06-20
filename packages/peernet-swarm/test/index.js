import Client from './../exports/client.js'
import Server from './../exports/server.js'

globalThis.DEBUG = true

pubsub.subscribe('peer:connected', (peer) => {
  console.log(peer);
  peer.send('hi')
})

const server = await new Server()
pubsub.subscribe('peer:data', (data) => console.log(new TextDecoder().decode(data.data)))

await new Client('a', 'peach')
const client = await new Client('b', 'peach')
