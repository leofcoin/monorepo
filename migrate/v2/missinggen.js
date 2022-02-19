const ethers = require('ethers')
const addresses = require('./../../addresses/addresses/binance-smartchain.json');
const PLATFORM_ABI = require('./../../build/contracts/ArtOnlinePlatform.json')
const MINING_ABI = require('./../../build/contracts/ArtOnlineMining.json')
const ARTONLINE_ABI = require('./../../build/contracts/ArtOnline.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed
const {writeFile} = require('fs')
const {promisify} = require('util')
const write = promisify(writeFile)
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})
const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider)

const oldPlatform = new ethers.Contract('0x1468221dc940909A0a85867d71351d2dA4A3AF0e', PLATFORM_ABI.abi, signer)
const oldMining = new ethers.Contract('0x1468221dc940909A0a85867d71351d2dA4A3AF0e', MINING_ABI.abi, provider)

const list = {
	"0x597a6220F900691390D93D13AE5787a4820f5DAE": 1886.7108307049148,
	"0x2B34693bF39679Dd426b8D6cF37Ff39c41AcCDd5": 11973.960513796383,
	"0xE6BB5B970eDBc4A86bDB8753196d3A70F1AA7012": 3666.7702988867345,
	"0xA4A5bCc1bf20FF188107194a9A17d7DDBbC4920C": 69453.95549952233,
	"0xf902aa42C93De86aDCCcDFA1B6d27c69B387DC89": 301.10120946724305,
	"0xFa370fF7eE4c6E0a46a45C5549fdD1Da04C14727": 2356.5054244715207,
	"0xf33e95d49c8D403aE09D744e315d1310821F9073": 1009.7160183141582,
	"0xD9842DbDFD708e7Ca8f0a18Fd3CA882EBe896Eeb": 718.5260920377475,
	"0xcE4F8F24EBDa374D9AAC6186961Cdd7899B0c284": 1429.158180254773,
	"0x2359C1B44f7CCF17c52c1fde6d21287fa52ce6f8": 1251.2739553527924,
	"0x17FC8984430a23f614a7C85496BF681A75Ac1e55": 3101.2202711498167,
	"0xb30e414767b430B3f0F3A3cB2BECAd2a842562FD": 1546.6276414558738,
	"0x4f24af10010C9910C79A6A7bB3fAB98CF0702144": 271.5697842347618,
	"0xD82F796dB456Fa13BBb0531CF92824B6C24259d3": 1896.0480466921395,
	"0x432e58D32a7B56dE860BDd82Bbe0187706d06dC6": 319.8803746260873,
	"0xF7A589D69Ebc58288ECd461860ca1292D20d484D": 21347.15431470358,
	"0x650D7b05454FCD30bde3155D14c455C11f173f96": 1896.4314640761977,
	"0x84c91979945a84Ee107D5b74fA36E90fFDeb20bc": 305.09840197663533,
	"0x8e0ED2A6523a0d03B6037b1F9c896dD95aaEde1d": 6649.306870358249,
	"0xDaa98b8653B69447f63759e09BFa0F3C3230F39d": 4164.653195130485,
	"0x7f893236FA9C57fA576Fa1dc5579fae51ec34418": 2126.530505091838,
	"0xfc6ADa1d33117A32bd4e09c333C497486D7a9710": 4528.34126164824,
	"0xaa4864C725C5b00FE7979FC95905Fe4c58B60F84": 375.42167385037425,
	"0x7e0Bd988b49290E0E86e1269a9323F347B717139": 2200.741100422544,
	"0x8c56072b1Bd47bf2A52aedfaE3825Aab56e63F3A": 2473.806167791591,
	"0x53d575091578e1df78DC2A28286147CF8B307eeA": 1751.6329511317604,
	"0x89CeC4875097d7A06622D901f389236752c850B9": 2113.097345015219,
	"0x5e586cC15c2771BF0e0eC3D3ce4e4F92527625dD": 4511.248017891202,
	"0x93089f0ab7cD43CefCD218ed725933f2200b3735": 4478.998868333484,
	"0x77aB994b244C5fba1B49CC775E6cf75c02EDE3F2": 742.4796369274277,
	"0xC8cF7463FC9714C884CE329F37E27A30A13E5B3A": 732.4575590872713,
	"0x085f2aB6C5c3591427a68f8DC64d2c954755511D": 105.5161365684341,
	"0x5254cB1487ea83284bB42e79447765529F383fd8": 34.68857289581872,
	"0x876214Db6d6a2cBd2127B6c4c26D118B41Ba473a": 59.9340153931783,
	"0x14Aa1fA2fcc5Efa0B4E524B94609B4B7f1eD2FfB": 1304.8288588183455,
	"0xd36f84CbF3b31fB3A40e7Fbe6DB4268F34E7f13A": 651.660682583787,
	"0xB171Aa1FD2Bcc4b64477695579c2EB0F0439A324": 37.506704505449086,
	"0x7Dbc930A23de567EB6811b60cc4aF3dd9c26f928": 270.3726262390274,
	"0x3529f23f77ea5DE7F49709bCE03d0470CFD180AC": 1334.4940211206688,
	"0x451Bdc6b3f4643DD53062D5a5041146347050e42": 176.8316299780477,
	"0xc720ca836768E26D13d5Bdc1302cCCAC99E5c7fC": 238.4791565511436,
	"0xCE2C46Bf1BF188375842F6B79580D1Dd5BF88Ec4": 9.959783733271006,
	"0x5EBc63A08419d054f92dEA90Ac1E71EeF3831e4D": 281.8221989916588,
	"0x01e81BC871bc3463032beaE0fac04615681D5140": 661.94150204607,
	"0x7cCc111A8257A1c801EA46B3eA992e6731Aa19Ff": 38.23209915885495,
	"0x507F84f9a762C9704960afa446a3262b9BEA12C4": 143.5045184760125
}

const platform = new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, signer)
const mining = new ethers.Contract(addresses.mining, MINING_ABI.abi, signer)
const artonline = new ethers.Contract(addresses.artonline, ARTONLINE_ABI.abi, signer)

const tokenLength = 6

const tokens = []
const tokenIds = [];

const totalSupply = {};
const pools = {};
const earnings = {};
let earners = {};
const batch = {};
const batched = {};

(async () => {

let tx = await platform._mintAssets('0xD81727C5f162C42970d323329C6585B79AE7A44f', '0', '1')
        await tx.wait()
      // totalMints[key] += Number(batch[key][address])
      // let _totalMints = totalMints[key]
      //
      // const tokens = []
      // const ids = []
      // for (let i = 1; i <= Number(batch[key][address]); i++) {
      //   ids.push(key)
      //   tokens.push(_totalMints)
      //
      //   _totalMints -= 1
      // }
      // try {
        // console.log('activating');
        // console.log(address, ids, tokens);
        // tx = await mining.activateGPUBatch(address, ids, tokens)
        // await tx.wait()
      // } catch (e) {
        // console.log(e);
      // }
      // let earning = await oldMining.callStatic.earned(address, key)
      // earning = ethers.utils.formatUnits(earning)
      // if (address === '0x1f94a873a0eA1Ab63D9d50cDc5e85fDc9b7cFe71' && key === '3') earning = 40020.925
      // earnings[address] = earnings[address] ? earnings[address] += Number(earning) : Number(earning)
  //   }
  // }

  // console.log(earnings);

  return
  // console.log(batch[0]);
  // console.log(batch[1]);
  // console.log(batch[2]);
  // console.log(batch[3]);
  // console.log(batch[4]);
return
  delete earners[5]

  for (let key of Object.keys(earners)) {
    for (address of earners[key]) {

    }
  }

  console.log('done earnings');
// pause platform
// let pausing = oldPlatform.pause()
// await pausing.wait()
// console.log('platform paused');
console.log('migrating platform');
// let nonce = await signer.getTransactionCount()

//   for (const key of Object.keys(batch)) {
//     for (const address of Object.keys(batch[key])) {
//       try {
//         let tx = await platform.mintBatch(address, batch[key][address].ids, batch[key][address].tokens, {nonce: nonce++})
//         console.log(tx);
//         await tx.wait()
//       } catch (e) {
//         nonce--
// console.warn(`ignored ${key, address}`);
//       } finally {
//
//       }
//     }
//   }
// console.log('minted cards');

  for (let key of Object.keys(earnings)) {
    // console.log(ethers.utils.formatUnits(earnings[key]).toString());
    if (earnings[key] == 0) return


    let tx = await artonline.mint(key, ethers.utils.parseUnits(earnings[key].toString()).toString(), {nonce: nonce++})
    await tx.wait()
  }
console.log('minted rewards');
delete batch[5]

  for (const key of Object.keys(batch)) {
    for (const address of Object.keys(batch[key])) {
      let tx = await mining.activateGPUBatch(address, batch[key][address].ids, batch[key][address].tokens, {nonce: nonce++})
      await tx.wait()
    }
  }


  // console.log(earnings);
  // write('earnings.json', JSON.stringify(earnings, null, '\t'))
  // write('owners.json', JSON.stringify(owners, null, '\t'))
  // console.log(totalSupply);
  // console.log(owners);
})()
