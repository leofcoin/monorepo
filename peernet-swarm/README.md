# peernet-swarm
> peernet peer discoverer & connector


## usage
### server
```js
import {Server} from '@leofcoin/peernet-swarm'

const network = 'leofcoin:peach'
const port = 44444

new Server(port, network)

```

### client
```js
import {Client} from '@leofcoin/peernet-swarm'

const network = 'leofcoin:peach'
const stars = ['wss://peach.leofcoin.org']

// wrtc object is added into glabalSpace
new Client(id, network, stars)

```

#### browser
```js
import {Client} from '@leofcoin/peernet-swarm/dist/client.browser.js'

// wrtc object is added into glabalSpace
new Client(id, network, stars)

```

## examples
events
```js
const client = new Client(id, network)
// events exposed to pubsub
pubsub.subscribe('peer:data' data => console.log(data))
pubsub.subscribe('peer:joined', peer => console.log(peer))
pubsub.subscribe('peer:left', peer => console.log(peer))
pubsub.subscribe('peer:connected', peer => console.log(peer))
peernet.subscribe('peernet-shard', async message => console.log(message) // {id, data, size}
// const finished = await _handleMessage()
```

properties
```js
const client = new Client(id, network)
client.id
client.connection
client.connections // object {id: connection}

```
