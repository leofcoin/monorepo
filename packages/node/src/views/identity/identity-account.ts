import { customElement } from 'lit/decorators.js'
import { IdentityAccounts } from './identity-accounts.js'

@customElement('identity-account')
export class IdentityAccountView extends IdentityAccounts {
  constructor() {
    super()
    this.expanded = true
  }
}
