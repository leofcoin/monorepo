import type AppShell from './shell.js'

// minimal needed interface to support routing & subrouting
export interface Selectable extends HTMLElement {
  pages: Selectable
  select: Function
  selected: string | HTMLElement | number
  applyRouteParameters?: (params: Record<string, string>) => void
}

const queryFields: Record<string, string[]> = {
  chat: ['invite'],
  'wallet/pay': ['to', 'amount', 'description', 'protocol', 'network', 'networkName'],
  'explorer/block': ['selected', 'index'],
  'explorer/transaction': ['selected', 'blockIndex', 'blockHash'],
  'explorer/account': ['address'],
  'identity/account': ['selected']
}

export function parseHashRoute(hash: string, origin: string) {
  // An actual navigation URL is data, not URLPattern's matching syntax. Root
  // the hash path explicitly; payment query strings must never become schemes.
  const url = new URL(`/${Router.debang(hash).replace(/^\/+/, '')}`, origin)
  const [route, ...subroutes] = url.pathname.slice(1).split('/')
  return { route, subroutes, params: Object.fromEntries(url.searchParams) }
}

export function applyRouteParameters(page: Selectable, path: string, params: Record<string, string>) {
  const fields = Object.hasOwn(queryFields, path) ? queryFields[path] : []
  const allowed = Object.fromEntries(fields.filter(key => Object.hasOwn(params, key)).map(key => [key, params[key]]))
  if (path === 'wallet/pay' || path === 'chat') {
    if (typeof page.applyRouteParameters !== 'function') throw new Error('Payment view is not ready for request parameters')
    page.applyRouteParameters(allowed)
    return
  }
  // Query strings may set only explicit view data, never DOM properties or
  // methods such as innerHTML, constructor, wallet, or select.
  for (const [key, value] of Object.entries(allowed)) page[key] = value
}

export default class Router {
  #host: AppShell

  get host() {
    return this.#host
  }

  constructor(host: AppShell, defaultView: string) {
    this.#host = host
    globalThis.onhashchange = this.#onhashchange

    if (Router.isbang(location.hash)) this.#onhashchange()
    else location.hash = Router.bang(defaultView)
  }

  static debang(hash) {
    return hash.startsWith('#!/') ? hash.slice(3) : hash
  }

  static bang(hash) {
    return `#!/${hash}`
  }

  static isbang(hash) {
    return hash.startsWith('#!/')
  }

  #onhashchange = async () => {
    const { params, route, subroutes } = parseHashRoute(location.hash, location.origin)

    if (route) {
      await this.#host.select(route)
      if (this.#host.requiresWallet) return
      let previousRoute = this.#host.pages?.querySelector('.custom-selected') as Selectable
      for (let attempt = 0; !previousRoute && attempt < 10; attempt += 1) {
        await new Promise(requestAnimationFrame)
        previousRoute = this.#host.pages?.querySelector('.custom-selected') as Selectable
      }
      if (!previousRoute) throw new Error(`route did not render: ${route}`)
      if (subroutes.length === 0 && !previousRoute.pages?.selected) {
        // handleDefaults
        if (route === 'wallet') subroutes.push('send')
        if (route === 'explorer' || route === 'identity') subroutes.push('dashboard')
      }
      for (const route of subroutes) {
        await previousRoute.select(route)
        previousRoute = previousRoute.pages?.querySelector('.custom-selected')

      }

      applyRouteParameters(previousRoute, [route, ...subroutes].join('/'), params)
    }
  }
}
