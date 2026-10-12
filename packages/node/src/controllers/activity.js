const key = 'leofcoin:peach:wallet-activity:v1'
export function readActivity(account) {
  try {
    const entries = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(entries)
      ? entries.filter((entry) => entry.from === account && typeof entry.hash === 'string')
      : []
  } catch {
    return []
  }
}
export function saveActivity(entry) {
  try {
    const entries = JSON.parse(localStorage.getItem(key) || '[]')
    const previous = Array.isArray(entries) ? entries : []
    localStorage.setItem(
      key,
      JSON.stringify([entry, ...previous.filter((item) => item.hash !== entry.hash)].slice(0, 100))
    )
  } catch {
    /* Storage failure must not change a transaction's network result. */
  }
  window.dispatchEvent(new Event('wallet-activity-changed'))
}
