export default class Router {
  get routes() {
    return [
      'market',
      'listing',
      'list',
      'collections',
      'auctions',
      'create',
      'account',
      'wallet'
    ]
  }

  constructor(pageController) {
    this.pageController = pageController
    globalThis.onhashchange = this._onhashchange.bind(this)

    onhashchange()
  }

  _isFirstVisit() {
    let visited = localStorage.getItem('visited')
    if (!visited) localStorage.setItem('visited', true)
    return Boolean(visited) ? false : true
  }

  async _onhashchange() {
    if (location.hash === '') {
      if (this._isFirstVisit()) location.href = `#!/market` // TODO: home!
      else location.href = `#!/market`
    }
    const hash = location.hash.slice(3, location.hash.length)
    let parts = hash.split('/')
    let query = []
    if (parts[0].includes('?')) {
      const result = parts[0].split('?')
      parts[0] = result[0]
      if (result.length > 1) {
        query = result.slice(1, result.length)
        query = query[0].split('&')
        query = query.reduce((p, c) => {
          const parts = c.split('=')
          p[parts[0]] = parts[1]
          return p
        }, {})
      }
    }
    if (this.routes.indexOf(parts[0]) === -1) return location.href = `#!/market`
    if (parts[0] === 'listing') {
      if (query.length === 0) {
        parts[0] = 'market'
        location.href = `#!/market`
      }
    }


    if (!customElements.get(`${parts[0]}-view`)) await import(`./${parts[0]}.js`)
    if (Object.keys(query).length > 0) {
      this.pageController.querySelector(`${parts[0]}-view`).parse(query)
    }
    this.pageController.select(parts[0])
  }
}
