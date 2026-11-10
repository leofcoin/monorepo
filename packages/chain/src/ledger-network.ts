/** Discovery labels must never change genesis IDs, wallet networks or signature domains. */
export function chainNetwork(fallback = 'leofcoin:peach', peer = globalThis.peernet): string {
  const context = peer as {ledgerNetwork?:string;network?:string} | undefined
  return context?.ledgerNetwork ?? context?.network ?? fallback
}
