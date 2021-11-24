export default (strings, ...params) => {

  if (!Array.isArray(params)) params = [params]
  strings = strings.map((string, i) => params[i] ? string += params[i] : string)
  return strings.join('')
}
