import Node from '@leofcoin/chain/node'
import Chain from '@leofcoin/chain/chain'
import nodeConfig from '@leofcoin/lib/node-config'
import WSClient from '@leofcoin/endpoint-clients/ws'
import HttpClient from '@leofcoin/endpoint-clients/http'
import networks from '@leofcoin/networks'

type launchMode = 'direct' | 'remote' | 'server'

type endpointReturns = {
  http: string[]
  ws: string[]
}

type clientReturns = {
  http: HttpClient[]
  ws: WSClient[]
}

type launchReturn = {
  chain?: Chain
  mode: launchMode
  endpoints: endpointReturns
  clients: clientReturns
}

type endpointOptions = {
  port: number
  url?: string
}

type launchOptions = {
  network?: string
  networkVersion?: string
  stars?: string[]
  forceRemote?: boolean
  mode?: launchMode
  root?: string
  ws?: endpointOptions[] | undefined
  http?: endpointOptions[] | undefined
}

type resolvedLaunchOptions = Required<Omit<launchOptions, 'ws' | 'http' | 'root'>> &
  Pick<launchOptions, 'root'> &
  Pick<launchOptions, 'ws' | 'http'>

const defaultOptions: resolvedLaunchOptions = {
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  stars: networks.leofcoin.peach.stars,
  forceRemote: false,
  mode: 'direct',
  root: undefined,
  ws: [
    {
      port: 4040
    }
  ],
  http: [
    {
      port: 8080
    }
  ]
}

/**
 *
 * @param {string} url
 * @param {string} networkVersion network/testnet-network sepperate by -
 * @returns Promise(boolean)
 */
const getHttp = async (url: string, networkVersion: string): Promise<undefined | HttpClient> => {
  try {
    const client = new HttpClient(url, networkVersion)
    await client.network()
    return client
  } catch (error) {
    return undefined
  }
}

const tryWs = (url: string, networkVersion: string): Promise<WSClient> =>
  new Promise(async (resolve, reject) => {
    try {
      const socket = await new WSClient(url, networkVersion)
      await socket.init()
      resolve(socket)
    } catch (error) {
      reject(error)
    }
  })

/**
 *
 * @param {string} url
 * @param {string} networkVersion network/testnet-network sepperate by -
 * @returns Promise(boolean)
 */
const getWS = async (url: string, networkVersion: string): Promise<WSClient | undefined> => {
  try {
    const ws = await tryWs(url, networkVersion)
    return ws
  } catch (error) {
    return undefined
  }
}

/**
 *
 * @param {string} httpURL
 * @param {string} wsURL
 * @param {string} networkVersion
 * @returns Promise({http: boolean, ws: boolean})
 */
const hasClient = async (httpURL: string, wsURL: string, networkVersion: string) => {
  const ws = await getWS(wsURL, networkVersion)
  const http = await getHttp(httpURL, networkVersion)
  return { http, ws }
}

// chain is undefined when mode is remote
// endpoints contain urls to connect to the desired remote
// when mode is remote means an instance is already running
// when mode is direct means chain is directly available and no endpoint is needed to interact with it
/**
 *
 * @param {object} options { ws: boolean || {url: string, port: number}, http: boolean || {url: string, port: number}, network}
 * @returns '{ mode: string, endpoints: object, chain}'
 */
const launch = async (input: launchOptions = {}, password?: string): Promise<launchReturn> => {
  const options: resolvedLaunchOptions = { ...defaultOptions, ...input }

  const clients: clientReturns = {
    http: [],
    ws: []
  }

  const endpoints: endpointReturns = {
    http: [],
    ws: []
  }

  let chain: Chain | undefined

  if (options.mode === 'remote') {
    if (options.http) {
      for (const endpoint of options.http) {
        const url = endpoint.url ?? `http://localhost:${endpoint.port}`
        const client = await getHttp(url, options.networkVersion)
        if (client) {
          endpoints.http.push(url)
          clients.http.push(client)
        }
      }
    }

    if (options.ws) {
      for (const endpoint of options.ws) {
        const url = endpoint.url ?? `ws://localhost:${endpoint.port}`
        const client = await getWS(url, options.networkVersion)
        if (client) {
          endpoints.ws.push(url)
          clients.ws.push(client)
        }
      }
    }
    if (endpoints.http.length === 0 && endpoints.ws.length === 0) throw new Error(`no remotes connected`)
  } else if (options.mode === 'direct') {
    const node = new Node(
      { network: options.network, stars: options.stars, networkVersion: options.networkVersion, root: options.root },
      password
    )
    await node.ready
    await nodeConfig({ network: options.network, networkVersion: options.networkVersion })

    chain = new Chain({ network: options.network, stars: options.stars, networkVersion: options.networkVersion })
    await chain.ready
    if (options.ws) {
      const importee = await import('@leofcoin/endpoints/ws')
      const wsServer = importee.default

      for (const endpoint of options.ws) {
        const url = endpoint.url ?? `ws://localhost:${endpoint.port}`

        await wsServer(chain, endpoint.port, options.networkVersion)
        endpoints.ws.push(url)

        const client = await getWS(url, options.networkVersion)
        client && clients.ws.push(client)
      }
    }

    if (options.http) {
      const importee = await import('@leofcoin/endpoints/http')
      const httpServer = importee.default

      for (const endpoint of options.http) {
        const url = endpoint.url ?? `http://localhost:${endpoint.port}`

        await httpServer(chain, endpoint.port, options.networkVersion)
        endpoints.http.push(url)

        const client = await getHttp(url, options.networkVersion)
        client && clients.http.push(client)
      }
    }
  } else {
    const node = new Node(
      { network: options.network, stars: options.stars, networkVersion: options.networkVersion, root: options.root },
      password
    )
    await node.ready
    await nodeConfig({ network: options.network, networkVersion: options.networkVersion })

    chain = new Chain({ network: options.network, stars: options.stars, networkVersion: options.networkVersion })
    await chain.ready
    if (options.ws) {
      const importee = await import('@leofcoin/endpoints/ws')
      const wsServer = importee.default

      for (const endpoint of options.ws) {
        const url = endpoint.url ?? `ws://localhost:${endpoint.port}`
        await wsServer(chain, endpoint.port, options.networkVersion)
        endpoints.ws.push(url)
      }
    }

    if (options.http) {
      const importee = await import('@leofcoin/endpoints/http')
      const httpServer = importee.default

      for (const endpoint of options.http) {
        const url = endpoint.url ?? `http://localhost:${endpoint.port}`
        await httpServer(chain, endpoint.port, options.networkVersion)
        endpoints.http.push(url)
      }
    }
  }

  return {
    chain,
    mode: options.mode,
    endpoints,
    clients
  }
}

export { launch as default }
