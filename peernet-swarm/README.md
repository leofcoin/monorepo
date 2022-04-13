# peernet-swarm
> peernet peer discoverer & connector


## usage
### server
```js
import {Server} from '@leofcoin/peernet-swarm'

new Server(port, id, identifiers)

```

### client
```js
import {Client} from '@leofcoin/peernet-swarm'

// wrtc object is added into glabalSpace
new Client(id, identifiers)

```

#### browser
```js
import {Client} from '@leofcoin/peernet-swarm/dist/client.browser.js'

// wrtc object is added into glabalSpace
new Client(id, identifiers)

```
