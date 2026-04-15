# contracts

## Leofcoin Class

The `Leofcoin` class extends the `Token` class from the `@leofcoin/standards/token.js` module. It represents a specific type of token with predefined properties.

### Constructor

#### `constructor(state: TokenState)`

Creates an instance of the `Leofcoin` class.

##### Parameters

- `state` (TokenState): The initial state of the token.

##### Example

```typescript
import Leofcoin from './native-token'
import { TokenState } from '@leofcoin/standards/token.js'

const initialState: TokenState = {
  // Define the initial state properties here
}

const leofcoin = new Leofcoin(initialState)
```
