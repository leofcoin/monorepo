# @leofcoin/mnemonic
> bip39 mnemonic

## install
```sh
npm i -S @leofcoin/mnemonic
```

## usage
english (derfault wordlist)
```js
import Mnemonic from '@leofcoin/mnemonic'

const mnemonic = new Mnemonic()

mnemonic.generate()
```

custom wordlist
```js
import Mnemonic from '@leofcoin/mnemonic'
import words from './words.js'

const mnemonic = new Mnemonic(words)

mnemonic.generate()
```

wallet seed
```js
import Mnemonic from '@leofcoin/mnemonic'

const mnemonic = new Mnemonic()

const phrase = mnemonic.generate()
mnemonic.seedFromMnemonic(phrase)
```
