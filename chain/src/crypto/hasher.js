const algorithms = {
  keccak256: input => keccak256(input)
}

export default {
  hash: (input, algorithm = 'keccak256') => algorithms[algorithm](input),
  doublehash: (input, algorithm = 'keccak256') => {
    let hash = await algorithms[algorithm](input)
    return algorithms[algorithm](hash)
  }
}
