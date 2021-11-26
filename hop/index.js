require('dotenv').config()
const {AMM, Hop, Chain,Token } = require('@hop-protocol/sdk')
const { Wallet } = require('ethers')
const { parseUnits, formatUnits } = require('ethers/lib/utils')
const Tx = require('ethereumjs-tx')
const Web3 = require('web3')
const fs = require("fs")



async function swap() {
    const privateKey = process.env.PRIVATE_KEY
    const signer = new Wallet(privateKey)

    const hop = new Hop('mainnet', signer)
    const bridge = hop.connect(signer).bridge('USDC')
    // send 10 USDC tokens from Polygon -> xDai

    const decimals = 6
    const amountBN = parseUnits('2', decimals)
    // const amountOut = await bridge.getAmountOut(amountBN, Chain.Ethereum, Chain.xDai)
    // console.log(amountOut.toBigInt())
    const tx = await bridge.send(amountBN, Chain.Polygon, Chain.xDai)
    console.log(tx.hash)
}
// swap()

function tansfer(from_key,to_addr,amount,is_matic=false) {
    const xdaiurl = 'https://rpc.xdaichain.com/';
    const xdaichainid = 0x64;
    const maticurl = "https://rpc-mainnet.matic.quiknode.pro";
    const maticchainid = 0x89;
    const web3 = new Web3(xdaiurl);
    var _from = "0xBa7cE7186719B90901c0687ABE5Ca0f2f36fA555";
    const privateKey = process.env.PRIVATE_KEY
    var privateKey1 = Buffer.from(privateKey, 'hex');//process.env.PRIVATE_KEY_1
    web3.eth.getTransactionCount(_from, (err, txcount) => {
        var txObject = {
            nonce: web3.utils.toHex(txcount),
            gasPrice: web3.utils.toHex(web3.utils.toWei('30', 'gwei')),
            gasLimit: web3.utils.toHex(21000),
            to: '0x86Fc8F04332446D5779a2bCA82D6cD50FC4e8365',
            value: web3.utils.toHex(web3.utils.toWei('1', 'ether')),
            chainId: xdaichainid
        }
        console.log(txObject);
        var tx = new Tx(txObject);
        tx.sign(privateKey1);
        var serializedTx = tx.serialize();

        web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'), function (err, hash) {
            if (!err) {
                console.log(hash);
            } else {
                console.log(err);
            }
        })
    });
}
// tansfer()

async function add_liquidity(){
    const privateKey = process.env.PRIVATE_KEY
    const signer = new Wallet(privateKey)

    const amm = new AMM('mainnet', 'USDC', Chain.xDai,signer);
    const decimals = 6
    const amountBN = parseUnits('2', decimals)
    const num = await amm.calculateAddLiquidityMinimum(amountBN,amountBN)
    console.log(num.toString())
    // const tx = await amm.addLiquidity(amountBN, amountBN, '0')
    // console.log(tx.hash)
}
// add_liquidity()


async function main(){
    let data = fs.readFileSync("key.txt","utf-8");
    const lines = data.split(/\r?\n/);
    //转让代币
    tansfer()
    //跨桥
    await swap()
    //添加流动性／移除流动性
    await add_liquidity()
}

main()