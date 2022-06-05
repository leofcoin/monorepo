const path = require('path');
const webpack = require('webpack');
module.exports = [{
  mode: 'production',
  entry: {
    messages: './src/messages.js'
  },
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
    chunkFilename: '[name].esm',
    filename: '[name].esm',
    path: path.resolve(__dirname, 'dist'),
  }
}];
