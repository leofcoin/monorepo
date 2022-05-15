export default class Roles {

  /**
   * Object => Array
   */
  #roles = {
    'OWNER': [],
    'MINT': [],
    'BURN': []
  }

  constructor(roles) {
    // allow devs to set their own roles but always keep the default ones included
    // also allows roles to be loaded from the stateStore
    // carefull when includin gthe roles make sure to add the owner
    // since no roles are granted by default when using custom roles
    if (roles) {
      if (roles instanceof Object) {
       this.#roles = {...roles, ...this.#roles}
      } else {
       throw new Error(`expected roles to be an object`)
      }
    } else {
      // no roles given so default to the msg sender
      this.#grantRole(msg.sender, 'OWNER')
    }
  }

  get state() {
    return { roles: this.roles }
  }

  get roles() {
    return {...this.#roles}
  }

  hasRole(address, role) {
    return this.#roles[role] ? this.#roles[role].indexOf(address) !== -1 : false
  }

  #grantRole(address, role) {
    if (this.hasRole(address, role)) throw new Error(`${role} role already granted for ${address}`)

    this.#roles[role].push(address)
  }

  #revokeRole(address, role) {
    if (!this.hasRole(address, role)) throw new Error(`${role} role already revoked for ${address}`)
    if (role === 'OWNER' && this.#roles[role].length === 1) throw new Error(`atleast one owner is needed!`)

    this.#roles[role].splice(this.#roles[role].indexOf(address))
  }

  grantRole(address, role) {
    if (!this.hasRole(address, 'OWNER')) throw new Error('Not allowed')

    this.#grantRole(address, role)
  }

  revokeRole(address, role) {
    if (!this.hasRole(address, 'OWNER')) throw new Error('Not allowed')

    this.#revokeRole(address, role)
  }
}
