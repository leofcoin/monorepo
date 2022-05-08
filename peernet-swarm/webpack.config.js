const path = require('path');
const webpack = require('webpack');
module.exports = [
  {
    entry: './dist/browser/client.js',
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
      path: path.resolve(__dirname, 'dist/browser'),
    }
  }
]
