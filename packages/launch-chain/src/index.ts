import Node from '@leofcoin/chain/node'
import Chain from '@leofcoin/chain/chain'
import nodeConfig from '@leofcoin/lib/node-config'
import WSClient from '@leofcoin/endpoint-clients/ws'
import HttpClient from '@leofcoin/endpoint-clients/http'
import networks from '@leofcoin/networks'

type launchMode = 'direct' | 'remote' | 'server'

type endpointReturns = {
  http?: string[]
  ws?: string[]
}

type clientReturns = {
  http?: HttpClient[]
  ws?: WSClient[]
}

type launchReturn = {
  chain: Chain
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
  stars: string[]
  forceRemote: boolean
  mode?: launchMode
  ws?: endpointOptions[] | undefined
  http?: endpointOptions[] | undefined
}

const defaultOptions: launchOptions = {
  network: 'leofcoin:peach',
  networkVersion: 'peach',
  stars: networks.leofcoin.peach.stars,
  forceRemote: false,
  mode: 'direct',
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
const getWS = async (url: string, networkVersion: string): Promise<WSClient> => {
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
const launch = async (options: launchOptions, password: string): Promise<launchReturn> => {
  if (!options) options = defaultOptions
  else options = { ...defaultOptions, ...options }

  const clients: clientReturns = {
    http: [],
    ws: []
  }

  const endpoints: endpointReturns = {
    http: [],
    ws: []
  }

  let chain: Chain

  if (options.mode === 'remote') {
    if (options.http) {
      for (const endpoint of options.http) {
        if (endpoint.port && !endpoint.url) endpoint.url = `http://localhost:${endpoint.port}`
        const client = await getHttp(endpoint.url, options.networkVersion)
        if (client) endpoints.http.push(endpoint.url) && clients.http.push(client)
      }
    }

    if (options.ws) {
      for (const endpoint of options.ws) {
        if (endpoint.port && !endpoint.url) endpoint.url = `ws://localhost:${endpoint.port}`
        const client = await getWS(endpoint.url, options.networkVersion)
        client && endpoints.ws.push(endpoint.url) && clients.ws.push(client)
      }
    }
    if (endpoints.http.length === 0 && endpoints.ws.length === 0) throw new Error(`no remotes connected`)
  } else if (options.mode === 'direct') {
    const node = new Node(
      { network: options.network, stars: options.stars, networkVersion: options.networkVersion },
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
        if (endpoint.port && !endpoint.url) endpoint.url = `ws://localhost:${endpoint.port}`

        await wsServer(chain, endpoint.port, options.networkVersion)
        endpoints.ws.push(endpoint.url)

        const client = await getWS(endpoint.url, options.networkVersion)
        client && clients.ws.push(client)
      }
    }

    if (options.http) {
      const importee = await import('@leofcoin/endpoints/http')
      const httpServer = importee.default

      for (const endpoint of options.http) {
        if (endpoint.port && !endpoint.url) endpoint.url = `http://localhost:${endpoint.port}`

        await httpServer(chain, endpoint.port, options.networkVersion)
        endpoints.http.push(endpoint.url)

        const client = await getHttp(endpoint.url, options.networkVersion)
        client && clients.http.push(client)
      }
    }
  } else {
    const node = new Node(
      { network: options.network, stars: options.stars, networkVersion: options.networkVersion },
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
        if (endpoint.port && !endpoint.url) endpoint.url = `ws://localhost:${endpoint.port}`
        await wsServer(chain, endpoint.port, options.networkVersion)
        endpoints.ws.push(endpoint.url)
      }
    }

    if (options.http) {
      const importee = await import('@leofcoin/endpoints/http')
      const httpServer = importee.default

      for (const endpoint of options.http) {
        if (endpoint.port && !endpoint.url) endpoint.url = `http://localhost:${endpoint.port}`
        await httpServer(chain, endpoint.port, options.networkVersion)
        endpoints.http.push(endpoint.url)
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
