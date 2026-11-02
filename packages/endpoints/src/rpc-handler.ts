/** Socket route dispatch does not await rejected promises; contain failures here. */
export const guardRpcHandler = handler => async (...args) => {
  const index = args.findIndex(value => value && typeof value.send === 'function')
  if (index < 0) return
  const response = args[index]
  const send = (value, status = 200) => response.send(value ?? null, status)
  args[index] = { ...response, send }
  try { return await handler(...args) }
  catch (error) {
    try { send({ error: error instanceof Error ? error.message : 'RPC operation failed' }, 422) }
    catch { /* The socket may already be closed; never reject the detached route. */ }
  }
}
