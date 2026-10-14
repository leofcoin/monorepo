// account/public is Peernet's existing-identity marker. Write it last, after
// the encrypted wallet and selected account are durable, to avoid generating
// a different identity when the browser node starts for the first time.
export async function bindWalletToNode(wallet, walletStore, accountStore) {
  if (
    !wallet?.identity?.walletId ||
    !wallet.identity.multiWIF ||
    !wallet.accounts?.length ||
    !wallet.accounts.some(
      ([, external, internal]) => wallet.selectedAccount === external || wallet.selectedAccount === internal
    )
  ) {
    throw new Error('Wallet identity or selected account is incomplete')
  }
  await walletStore.put('identity', JSON.stringify(wallet.identity))
  await walletStore.put('accounts', JSON.stringify(wallet.accounts))
  await walletStore.put('version', '1')
  await walletStore.put('selected-account', wallet.selectedAccount)
  await accountStore.put('public', JSON.stringify({ walletId: wallet.identity.walletId }))
}
