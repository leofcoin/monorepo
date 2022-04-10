export default class Server {
  constructor(port, identifiers = []) {
    if (identifiers.length === 0) identifiers.push('peernet-v0.1.0')
  }
}
