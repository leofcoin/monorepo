const Wallet = require('./')

let w = new Wallet().then((w) => console.log(w.wallet))