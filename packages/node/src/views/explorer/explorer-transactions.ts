import { customElement } from 'lit/decorators.js'
import { ExplorerLedgerList } from '../../elements/explorer/ledger-list.js'

@customElement('explorer-transactions')
export class ExplorerTransactions extends ExplorerLedgerList {
  get mode() { return 'transactions' }
}
