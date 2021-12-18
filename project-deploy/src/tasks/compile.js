import handleImports from './handle-import.js'
import './add-license.js'
import addPragmaVersion from './add-pragma-version.js'
import setPragmaVersion from './set-pragma-version.js'
import solc from 'solc'

export default async (sources, dependecies, config) => {
  const input = {
    language: 'Solidity',
    sources: {...sources, dependencies },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*']
        }
      }
    }
  };

  let output = solc.compile(JSON.stringify(input))
  output = JSON.parse(output);

  if (output.errors) {

      for (const error of output.errors) {
        const {errorCode, sourceLocation, type, formattedMessage} = error
        if (type === 'Error') return console.error(error);
        if (errorCode === '1878') config.autoFix && config.licence && await addLicence(config.license)
        else if (errorCode === '3420') config.autoFix && await addPragmaVersion(solc.semver(), sourceLocation)
        else if (errorCode === '5333') config.autoFix && await setPragmaVersion(solc.semver(), sourceLocation)
        else console.warn(error)
      }
      delete output.errors
  }
    for (const path of Object.keys(output.contracts)) {
     const contract = output.contracts[path]
     for (const contractName of Object.keys(output.contracts[path])) {
       console.log(contractName);
       // console.log(contract[contractName].evm.deployedBytecode);
       console.log( ((contract[contractName].evm.deployedBytecode.object.length - 2) / 2 / 1024).toFixed(2));
     }


    // console.log(contract.evm.deployedBytecode);
    // console.log(contractName);
    // console.log(output.contracts[path][contractName].evm);
    // console.log(
    //   contractName +
    //     ': ' +
    //     output.contracts[path][contractName].evm.bytecode.object
    // );
  }
}
