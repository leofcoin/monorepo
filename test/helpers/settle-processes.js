// Await every bounded process operation, including failures, before the caller
// removes its stores. Promise.all alone returns while siblings may still write.
export async function settleProcesses(operations) {
  const results = await Promise.allSettled(operations)
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason)
  if (failures.length) throw new AggregateError(failures, 'One or more isolated processes failed', { cause: failures[0] })
  return results.map(result => result.value)
}
