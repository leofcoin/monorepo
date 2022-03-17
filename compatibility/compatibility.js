const _mac = [
  ['event.path', 'possible path usage in event detected, use event.composedPath() instead'],
  ['event.path[0]', 'possible path usage in event detected, use event.composedPath() instead'],
  ['event.path[1]', 'possible path usage in event detected, use event.composedPath() instead'],
  ['event.path[2]', 'possible path usage in event detected, use event.composedPath() instead'],
  ['event.target', 'possible target usage in event detected, use event.composedPath() instead']
]

const windows = []

export default (string, platform = ['windows', 'mac']) => {
  if (!Array.isType(platform)) platform = [...platform]

  const warnings = []
  for (const os of platform) {
    for (const target of `_${os}`) {
      const index = string.indexOf(target[0])
      if (index !== -1) warnings.push(`${target[0]}: ${target[1]} @${index}`)
    }
  }
  console.log(warnings);
}
