import { customElement } from 'lit/decorators.js'
import { ExplorerLedgerList } from '../../elements/explorer/ledger-list.js'

@customElement('explorer-pool')
export class ExplorerPool extends ExplorerLedgerList {
  get mode() { return 'pool' }
}
