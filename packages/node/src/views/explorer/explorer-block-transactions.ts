import { customElement } from '@vandeurenglenn/lite'
import { ExplorerBlock } from './explorer-block.js'

// Existing deep links use the same paginated block detail view.
@customElement('explorer-block-transactions')
export class ExplorerBlockTransactions extends ExplorerBlock {}
