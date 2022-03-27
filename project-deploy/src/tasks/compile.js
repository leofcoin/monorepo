import handleImports from './handle-import.js'
import addLicence from './add-license.js'
import addPragmaVersion from './add-pragma-version.js'
import setPragmaVersion from './set-pragma-version.js'
import solc from 'solc'
import {write} from './../utils.js'
import {join} from 'path'

export default async (sources, dependencies, config, solcConfig, logger) => {
  const input = {
    language: 'Solidity',
    sources: {...sources, ...dependencies },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'metadata', 'evm.bytecode']
        }
      }
    }
  };

  let output = solc.compile(JSON.stringify(input), {cwd: process.cwd()})
  output = JSON.parse(output);

  if (output.errors) {
      globalThis.deployable = false
      for (const error of output.errors) {
        try {
          const {errorCode, sourceLocation, type, formattedMessage} = error
          if (type === 'Error') return logger.fail(error);
          if (errorCode === '1878') config.autoFix && config.license && await addLicence(config.license, sourceLocation.file, logger)
          else if (errorCode === '3420') config.autoFix && await addPragmaVersion(solc.semver().split('+')[0], sourceLocation.file, logger)
          else if (errorCode === '5333') config.autoFix && await setPragmaVersion(solc.semver().split('+')[0], sourceLocation.file, logger)
          else logger.fail(`${type}: ${formattedMessage}`)

          if (!config.autoFix) {
            logger.info(`${errorCode}: ${formattedMessage}`)
          } else {
            logger.info(`undeployable! fixes have been applied, rerun to deploy`)
          }
        } catch (e) {
          globalThis.deployable = false
          logger.fail(JSON.stringify(e))
        }
      }
      delete output.errors
  }
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
  let flat = ''
  let _contract = {}
    try {
      logger.info(`updating abis`);
      for (const path of Object.keys(output.contracts).reverse()) {
       const contract = output.contracts[path]
       for (const contractName of Object.keys(contract)) {

         if (contract[contractName].abi.length > 0) {
           await write(join(config.abiPath, `${contractName}.json`), JSON.stringify(contract[contractName].abi, null, 2))
         }

         if (sources[path]) {
           flat += sources[path].content.replace(/pragma solidity (.*);/g, '').replace(/\/\/ SPDX-License-Identifier\: (.*)/g, '')
           flat = flat.replace(/import \'(.*)+\w\.(sol)\'\;|import \"(.*)+\w\.(sol)\"\;/g, '')

           logger.info(`updating flat`);
           await write(join(config.flatsPath, `${contractName}.sol`), flat)

           await write(join(config.bytecodePath, `${contractName}.json`), JSON.stringify(contract[contractName].evm.bytecode.object, null, 2))

           const size = formatBytes((contract[contractName].evm.bytecode.object.length - 2) / 2, 2)
           logger.info(`size: ${size}`)
           _contract.abi = contract[contractName].abi
           _contract.contractName = contractName
           _contract.bytecode = contract[contractName].evm.bytecode.object
         }

         if (dependencies[path]) {
           if (Object.keys(dependencies).indexOf(dependencies[path]) !== 0) {
             flat += dependencies[path].content.replace(/pragma solidity (.*);/g, '').replace(/\/\/ SPDX-License-Identifier\: (.*)/g, '')
           } else {
             flat += dependencies[path].content
           }
         }
       }
     }
    } catch (e) {
      logger.fail(e.message)
    }

    return _contract
}
