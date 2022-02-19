const {writeFile} = require('fs');
const {join} = require('path');
const holders = require('./nft-holders.json')
const batched = {}

let i = 0
for (const gpu of Object.keys(holders)) {
  for (const holder of holders[gpu]) {
    let {ids, amounts} = batched[holder.address] || {ids: [], amounts: []}
    ids.push(i)
    amounts.push(holder.id)
    batched[holder.address] = {ids, amounts}
  }
  i++
}

writeFile(join(__dirname, 'nft-holders-batch.json'), JSON.stringify(batched, null, '\t'), () => {
  
})
