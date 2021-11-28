export default class BaseAPI {
  constructor(network = {}) {
  }
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.onload = () => resolve()
      script.onerror = () => reject()
      script.src = src
      document.head.appendChild(script)
    });
  }

  get assets() {
    return {
      cards: {
        GENESIS: './assets/cards/GENESIS-320.png',
        'ARTX 1000': './assets/cards/ARTX 1000-320.png',
        'ARTX 2000': './assets/cards/ARTX 2000-320.png',
        'XTREME': './assets/cards/XTREME-320.png'
      },
      fans: {
        GENESIS: './assets/fans/GENESIS.png',
        'ARTX 1000': './assets/fans/ARTX 1000.png',
        'ARTX 2000': './assets/fans/ARTX 2000.png',
        'XTREME': './assets/fans/XTREME.png'
      },
      fronts: {
        'XTREME': './assets/fronts/XTREME.png'
      },
      configs: {
        GENESIS: {
          fans: [
            ['4%', '30%', '76px', '76px'],
            ['35.5%', '30%', '76px', '76px'],
            ['68%', '30%', '76px', '76px']
          ] // x, y, h, w
        },
        'ARTX 1000': {
          fans: [
            ['73.5%', '33%', '48px', '48px'],
          ] // x, y, h, w
        },
        'ARTX 2000': {
          fans: [
            ['25%', '12.5%', '75px', '75px'],
            ['63.3%', '12.5%', '75px', '75px']
          ] // x, y, h, w
        },
        'XTREME': {
          fans: [
            ['12%', '12.5%', '80px', '80px'],
            ['39%', '15%', '75px', '75px', 1],
            ['64.3%', '12.5%', '80px', '80px']
          ], // x, y, h, w, id
          fronts: [
            ['22%', '6%', '76%', '62.5%']
          ]
        }
      }
    }
  }

  get maximumSupply() {
    return {
      GENESIS: 50,
      'ARTX 1000': 450,
      'ARTX 2000': 250,
      'XTREME': 133
    }
  }

  getAssetFor(symbol) {
    return this.assets[symbol]
  }
}
