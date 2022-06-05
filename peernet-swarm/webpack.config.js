const path = require('path');
const webpack = require('webpack');
module.exports = [
  {
    entry: {
      client: './src/client/client.js'
    },
    mode: 'production',
    optimization: {
      minimize: false
    },
    experiments: {
      outputModule: true
    },
    output: {
      library: {
        type: 'module'
      },
      filename: 'client.js',
      chunkFilename: '[name].js',
      path: path.resolve(__dirname, 'dist/browser'),
    }
  }
]
