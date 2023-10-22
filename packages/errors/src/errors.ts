export class LeofcoinError extends Error {
  #message: string
  constructor(message: string, options?: {cause: Error | LeofcoinError}) {
    super(message, options)
    this.#message = message
  }

  get message() {
    return `${this.name}: ${this.#message}`
  }
}

export class ResolveError extends LeofcoinError {
  name: string = 'ResolveError'
}

export class SyncError extends LeofcoinError {
  name: string = 'SyncError'
}

export class InvalidBlockError extends LeofcoinError {
  name: string = 'InvalidBlockError'
}

export class ExecutionError extends LeofcoinError {
  name: string = 'ExecutionError'
}

export class ContractDeploymentError extends LeofcoinError {
  name: string = 'ContractDeploymentError'
}

export const isResolveError = (error: LeofcoinError) => error.name === 'ResolveError'

export const isSyncError = (error: LeofcoinError) => error.name === 'SyncError'

export const isInvalidBlockError = (error: LeofcoinError) => error.name === 'InvalidBlockError'

export const isExecutionError = (error: LeofcoinError) => error.name === 'ExecutionError'

export const isContractDeploymentError = (error: LeofcoinError) => error.name === 'ContractDeploymentError'
