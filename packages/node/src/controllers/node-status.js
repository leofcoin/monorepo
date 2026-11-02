// Presentation only: never changes chain state or declares transaction finality.
export function blockHeight(value) {
  if (typeof value !== 'bigint' && typeof value !== 'number') return null
  const height = Number(value)
  return Number.isSafeInteger(height) && height >= -1 ? height : null
}

export function nodeStatus({ started = false, error = '', sync, local, target, start,
  connections = {}, version, resolved = 0, loaded = 0 }) {
  const peers = Object.entries(connections).filter(([, peer]) => peer?.connected === true)
  const protocol = value => typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(value)
    ? value.split('.').slice(0, 2).join('.') : null
  const localProtocol = protocol(version)
  const compatible = peers.filter(([, peer]) => localProtocol && protocol(peer.version) === localProtocol).length
  const negotiating = peers.filter(([, peer]) => !protocol(peer.version)).length
  local = blockHeight(local)
  target = blockHeight(target)
  start = blockHeight(start)
  const hasTarget = target !== null && target >= 0
  const ready = Boolean(started && !error && compatible && sync === 'synced' && local !== null && local >= 0 && (!hasTarget || local >= target))
  let state = 'connecting'
  let label = 'Connecting…'
  if (error) { state = 'error'; label = 'Node unavailable' }
  else if (!started) { state = 'locked'; label = 'Wallet locked' }
  else if (!peers.length) { state = 'offline'; label = 'Waiting for peers' }
  else if (!compatible) label = negotiating ? 'Checking peer versions…' : 'No compatible peers'
  else if (sync === 'errored') { state = 'error'; label = 'Sync interrupted' }
  else if (ready) { state = 'ready'; label = 'Node synced' }
  else if (hasTarget) { state = 'syncing'; label = 'Syncing chain' }
  const span = hasTarget && start !== null ? target - start : 0
  const progress = ready ? 100 : hasTarget && local !== null && span > 0
    ? Math.max(0, Math.min(100, Math.round((local - start) / span * 100))) : null
  if (state === 'syncing' && progress !== null) label = `Syncing ${progress}%`
  return { state, label, ready, started, error, progress, local, target, resolved, loaded,
    compatible, negotiating, peers: peers.map(([id]) => id),
    peerDetails: peers.map(([id, peer]) => ({ id, version: typeof peer.version === 'string' ? peer.version : null,
      compatible: Boolean(localProtocol && protocol(peer.version) === localProtocol) })) }
}
