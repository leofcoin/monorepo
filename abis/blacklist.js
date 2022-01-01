export default [{"inputs":[{"internalType":"address","name":"artOnlineAccess_","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"bool","name":"","type":"bool"}],"name":"Blacklist","type":"event"},{"inputs":[{"internalType":"address","name":"artOnlineAccess_","type":"address"}],"name":"setArtOnlineAccess","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"artOnlineAccess","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"bool","name":"blacklist_","type":"bool"}],"name":"blacklist","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"blacklisted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}]