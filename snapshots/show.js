let balances = require('./13187019/balances/ARTEON.json');
let blacklist = require('./blacklist.json')
const {writeFile} = require('fs')

// blacklist = blacklist.map(addr => addr.toLowerCase())

balances = balances.filter(holder => {
  if (holder.balance === '0.000000000000000000') return false;
  if (holder.balance === '0.000000000000000001') return false;
  return blacklist.indexOf(holder.wallet) === -1 ? holder : false
})



console.log(balances);
console.log(balances.length);

writeFile('snapshot.json', JSON.stringify(balances, null, '\t'), () => {

const holders = balances.map(holder => holder.wallet)
balances = balances.map(holder => holder.balance)

writeFile('snapshot.balances.json', JSON.stringify(balances, null, '\t'), () => {})
writeFile('snapshot.holders.json', JSON.stringify(holders, null, '\t'), () => {})
})
