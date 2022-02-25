import Koa from 'koa'

import jobber from './jobber'
import exchange from './api/exchange'
import platform from './api/platform'
import nft from './api/nft'
import faucet from './api/faucet'
import token from './api/token'
import cors from '@koa/cors'
const server = new Koa()

server.use(cors({origin: '*'}))

server.use(nft.routes())
server.use(exchange.routes())
server.use(platform.routes())
server.use(faucet.routes())
server.use(token.routes())

server.listen(9044)
