export default async (network = 'ropsten') => {
  const importee = await import(`./addresses/${network}.js`)
  return importee.default
}
