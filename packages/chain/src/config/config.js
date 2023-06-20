import main from './main.js'
import protocol from './protocol.js'

// export default async () => {
//   let config = { ...main, protocol }
//   try {
//     let data = await read(main.configPath)
//     data = JSON.parse(data.toString())
//     config = { ...config, ...data }
//   } catch (e) {
//     await write(main.configPath, JSON.stringify(config, null, '\t'))
//   }
//   return config
// }
