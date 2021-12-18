import solc from 'solc'

export default async (input, dest) => {
  input = {
    language: 'Solidity',
    sources: {
      input
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*']
        }
      }
    }
  };

  let output = solc.compile(JSON.stringify(input))
  output = JSON.parse();

  // `output` here contains the JSON output as specified in the documentation
  for (const path of Object.keys(output.contracts)) {
    const contractName = output.contracts[path]
    console.log(
      contractName +
        ': ' +
        output.contracts[path][contractName].evm.bytecode.object
    );
  }
}
