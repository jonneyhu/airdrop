require('dotenv').config()
const {AMM, Hop, Chain,Token } = require('@hop-protocol/sdk')
const { Wallet } = require('ethers')
const { parseUnits, formatUnits } = require('ethers/lib/utils')
const Tx = require('ethereumjs-tx')
const Web3 = require('web3')
const fs = require("fs")
const util = require("util")
const HDWalletProvider = require('@truffle/hdwallet-provider')
const { addresses } = require('@hop-protocol/core/addresses/kovan')
const { url } = require('inspector')
const maticUsdc = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
const maticHusdc = '0x9ec9551d4a1a1593b0ee8124d98590cc71b3b09d';

// async function balance(){
//     const xdaiurl = 'https://rpc.xdaichain.com/';
//     const xdaichainid = 0x64;
//     const maticurl = "https://rpc-mainnet.matic.quiknode.pro";
//     const maticchainid = 0x89;
//     const web3 = new Web3(maticurl);
//     var _from = "0xBa7cE7186719B90901c0687ABE5Ca0f2f36fA555";
//     let balance = await web3.eth.getBalance(_from);
//     let price = await web3.eth.getGasPrice();
//     console.log(balance,price);
// }
async function getBalance(addr,chain,contract='',decimals=18){
    if (contract==''){
        const token = new Token('mainnet',chain,maticUsdc,decimals)
        const balance = await token.getNativeTokenBalance(addr);
        console.log(balance.toString());
    }else{
        const token = new Token('mainnet',chain,maticUsdc,decimals)
        const balance = await token.balanceOf(addr);
        console.log(balance.toString());
    }
  
 }
const swapAbi = [{
    inputs: [
        {
            internalType: "uint8",
            name: "tokenIndexFrom",
            type: "uint8"
        },
        {
            internalType: "uint8",
            name: "tokenIndexTo",
            type: "uint8"
        },
        {
            internalType: "uint256",
            name: "dx",
            type: "uint256"
        },
        {
            internalType: "uint256",
            name: "minDy",
            type: "uint256"
        },
        {
            internalType: "uint256",
            name: "deadline",
            type: "uint256"
        }
    ],
    name: "swap",
    outputs: [
        {
            internalType: "uint256",
            name: "",
            type: "uint256"
        }
    ],
    stateMutability: "nonpayable",
    type: "function"
},]
 async function fromHop(){
    const privateKey = process.env.PRIVATE_KEY
    const url = 'https://polygon-rpc.com'
    // const provider = new HDWalletProvider(privateKey,url)
    const signer = new Wallet(privateKey,provider)
    const hop = new Hop('mainnet')
    const bridge = hop.connect(signer).bridge('USDC')
    // console.log(chain.provider)
    // const web3Instance = new Web3(provider)
    // const swapContract =  new web3Instance.eth.Contract(
    //     swapAbi,
    //     '0x5C32143C8B198F392d01f8446b754c181224ac26',
    //     {gasLimit:'1000000'}
    // )
    // const tx = swapContract.methods.swap(1,0,473666,471244,1638775704).send({from:'0xBa7cE7186719B90901c0687ABE5Ca0f2f36fA555'})
    const tx = await bridge.execSaddleSwap(Chain.Polygon,false,'473700')
    console.log(tx.transactionHash);
 }


async function swap(privateKey,amount) {
    // const privateKey = process.env.PRIVATE_KEY
    const signer = new Wallet(privateKey)
    const hop = new Hop('mainnet', signer)
    const bridge = hop.connect(signer).bridge('USDC')
    // send 10 USDC tokens from Polygon -> xDai
    const decimals = 6
    const amount_s = util.format('%s',amount);
    const amountBN = parseUnits(amount_s, decimals);
    const amountOut = await bridge.getAmountOut(amountBN, Chain.Polygon, Chain.xDai)
    console.log(amountOut.toString())
    const tx = await bridge.send(amountBN, Chain.Polygon, Chain.xDai)
    console.log(tx.hash)
    // setTimeout(async function(){
    //     let tx2 = await bridge.send(amountOut.toString(),chain.xDai,chain.Polygon);
    //     console.log(tx2.hash);
    // },5000)
   
}


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

async function add_liquidity(privateKey,amount){
    // const privateKey = process.env.PRIVATE_KEY
    const signer = new Wallet(privateKey)

    const amm = new AMM('mainnet', 'USDC', Chain.Polygon,signer);
    // const hop = new Hop('mainnet', signer)
    // const bridge = hop.connect(signer).bridge('USDC')
    const decimals = 6
    const amount_s = util.format('%s',amount);
    const amountBN = parseUnits(amount_s, decimals)
    // const tx = await bridge.addLiquidity(amountBN,'0',Chain.Polygon)
    // const num = await amm.calculateAddLiquidityMinimum(amountBN,amountBN)
    // console.log(num.toString())
    const tx = await amm.addLiquidity(amountBN, '0', '0')
    console.log(tx.hash)
    // setTimeout(async function(){
    //     let amountlp = amount*0.97 ;
    //     const decimals = 6
    //     const amount_s = util.format('%s',amountlp);
    //     const amountBN = parseUnits(amount_s, decimals)
    //     let tx = await amm.removeLiquidity()
    // },60000)
}
// add_liquidity()


async function main(){
    let data = fs.readFileSync("key.txt","utf-8");
    const lines = data.split(/\r?\n/);

    for(var i=0;i<lines.length;i++){
        let item = lines[i];
        let line = item.split(" ") ;
        let addr = line[0];
        let key = line[1];
        console.log(addr,key);
        // 先完成垮桥，然后添加流动性，移除流动性，最后将代币转移到下一个地址
        await swap(key)
    }
     //转让代币
    // tansfer()
    //跨桥
    // await swap()
    //添加流动性／移除流动性
    // await add_liquidity()
}



swap('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f',2)
// getBalance('0x86Fc8F04332446D5779a2bCA82D6cD50FC4e8365',Chain.Polygon,maticUsdc,6)
// fromHop()
// add_liquidity('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f',1)