require('dotenv').config()
const { AMM, Hop, Chain, Token } = require('@hop-protocol/sdk')
const { Wallet, providers } = require('ethers')
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
const usdcLp = '0x9d373d22fd091d7f9a6649eb067557cc12fb1a0a';
const xdaiUsdc = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83';


async function getBalance(addr, chain, contract = '', decimals = 18) {
    if (contract == '') {
        const token = new Token('mainnet', chain, maticUsdc, decimals)
        const balance = await token.getNativeTokenBalance(addr);

        return balance;
    } else {
        const token = new Token('mainnet', chain, contract, decimals)
        const balance = await token.balanceOf(addr);

        return balance;
    }

}
const erc20TransferAbi = [{
    inputs: [
        {
            internalType: "address",
            name: "recipient",
            type: "address"
        },
        {
            internalType: "uint256",
            name: "amount",
            type: "uint256"
        }
    ],
    name: "transfer",
    outputs: [
        {
            internalType: "bool",
            name: "",
            type: "bool"
        }
    ],
    stateMutability: "nonpayable",
    type: "function"
},]
async function fromHop() {
    const privateKey = process.env.PRIVATE_KEY
    const url = 'https://polygon-rpc.com'
    // const provider = new HDWalletProvider(privateKey,url)
    // console.log(provider);
    const provider = new providers.JsonRpcProvider(url)

    const wallet = new Wallet(privateKey, provider)
    const signer = wallet.connect(provider)
    console.log(provider.getSigner())
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
    const decimals = 6
    const amount_s = util.format('%s', 0.4);
    const amountBN = parseUnits(amount_s, decimals);
    const tx = await bridge.execSaddleSwap(Chain.Polygon, false, amountBN, amountBN, 1638348800)
    console.log(tx.transactionHash);
}


async function swap(privateKey, amount) {
    // const privateKey = process.env.PRIVATE_KEY
    const url = 'https://polygon-rpc.com'
    const provider = new providers.JsonRpcProvider(url)
    const signer = new Wallet(privateKey, provider)
    const hop = new Hop('mainnet', signer)
    const bridge = hop.connect(signer).bridge('USDC')
    const decimals = 6
    const amount_s = util.format('%s', amount);
    const amountBN = parseUnits(amount_s, decimals)
    const tx = await bridge.send(amountBN, Chain.Polygon, Chain.xDai)
    console.log('send from matic:',tx.hash)
    setTimeout(async function () {
        let amountBN = await getBalance(signer.address, Chain.xDai, xdaiUsdc, 6)
        let tx2 = await bridge.send(amountBN, chain.xDai, chain.Polygon);
        console.log('send from xdai',tx2.hash);
    }, 5000)

}

async function erc20Transfer(from_key, to_addr, amount) {
    const maticurl = "https://rpc-mainnet.matic.quiknode.pro";
    const maticchainid = 0x89;
    const web3 = new Web3(maticurl);
    const signer = new Wallet(privateKey);
    var _from = signer.address;
    var balance = await getBalance(_from, Chain.Polygon)
    var privateKey = Buffer.from(from_key, 'hex');
    const matic_contract = web3.eth.contract(erc20TransferAbi).at(maticUsdc)
    web3.eth.getTransactionCount(_from, (err, txcount) => {
        var txObject = {
            nonce: web3.utils.toHex(txcount),
            gasPrice: web3.utils.toHex(web3.utils.toWei('30', 'gwei')),
            gasLimit: web3.utils.toHex(21000),
            to: to_addr,
            data: matic_contract.methods.tansfer(to_addr, balance.toBigInt()).encodeABI(),
            chainId: maticchainid
        }
        var tx = new Tx(txObject);
        tx.sign(privateKey);
        var serializedTx = tx.serialize();

        web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'), function (err, hash) {
            if (!err) {
                console.log('erc20transfer:', hash);
            } else {
                console.log(err);
            }
        })
    })
}


async function nativateTansfer(from_key, to_addr, ismatic = false) {
    //将from的原生代币和usdc全部转给to地址　先转usdc再转原生代币（手续费）
    const xdaiurl = 'https://rpc.xdaichain.com/';
    const xdaichainid = 0x64;
    const maticurl = "https://rpc-mainnet.matic.quiknode.pro";
    const maticchainid = 0x89;
    const fee = 0.001 * (Math.pow(10, 18));
    if (ismatic) {
        var web3 = new Web3(maticurl);
        var gasprice = web3.utils.toHex(web3.utils.toWei('30', 'gwei'))
        const signer = new Wallet(privateKey);
        var _from = signer.address;
        var balance = await getBalance(_from, Chain.Polygon)
        var amount = balance - fee;
        var chainid = maticchainid;

    } else {
        var web3 = new Web3(xdaiurl);
        var gasprice = web3.utils.toHex(web3.utils.toWei('2', 'gwei'))
        const signer = new Wallet(privateKey);
        var _from = signer.address;
        var balance = await getBalance(_from, Chain.xDai)
        var amount = balance - fee;
        var chainid = xdaichainid;
    }


    var privateKey = Buffer.from(from_key, 'hex');//process.env.PRIVATE_KEY_1
    web3.eth.getTransactionCount(_from, (err, txcount) => {
        var txObject = {
            nonce: web3.utils.toHex(txcount),
            gasPrice: gasprice,
            gasLimit: web3.utils.toHex(21000),
            to: to_addr,
            value: web3.utils.toHex(amount),
            chainId: chainid
        }
        var tx = new Tx(txObject);
        tx.sign(privateKey);
        var serializedTx = tx.serialize();

        web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'), function (err, hash) {
            if (!err) {
                console.log('nativate_transfer:', hash);
            } else {
                console.log(err);
            }
        })
    });


}
// tansfer()

async function add_remove_liquidity(privateKey, amount) {
    // const privateKey = process.env.PRIVATE_KEY
    const url = 'https://polygon-rpc.com'
    const provider = new providers.JsonRpcProvider(url)
    const signer = new Wallet(privateKey, provider)
    const hop = new Hop('mainnet', signer)
    const bridge = hop.connect(signer).bridge('USDC')
    const decimals = 6
    const amount_s = util.format('%s', amount);
    const amountBN = parseUnits(amount_s, decimals)
    const tx = await bridge.addLiquidity(amountBN, '0', Chain.Polygon)
    console.log('add_liquidity:', tx.hash)
    setTimeout(async function () {
        let amountlp = await getBalance(signer.address, Chain.Polygon, usdcLp, 6);
        let tx = await bridge.removeLiquidityOneToken(amountlp, 0, Chain.Polygon)
        console.log('remove_liquidity:', tx.hash)
    }, 180000)
}


async function main() {
    let data = fs.readFileSync("key.txt", "utf-8");
    const lines = data.split(/\r?\n/);

    for (var i = 0; i < lines.length; i++) {
        if (i == 2) {
            break
        }
        let item = lines[i];
        let line = item.split(" ");
        let addr = line[0];
        let key = line[1];
        let item2 = lines[i + 1];
        let to_addr = item2.split(" ")[0];
        const usdc_balance = await getBalance(addr, Chain.Polygon, maticUsdc, 6)
        const nativate_balance = await getBalance(addr, Chain.Polygon)
        console.log('[%s] usdc(%s) matic(%s)', addr, usdc_balance.toString(), nativate_balance.toString())
        // 先完成垮桥，然后添加流动性，移除流动性，最后将代币转移到下一个地址
        try {
            await swap(key, 20);
            await add_remove_liquidity(key, 12);
            await erc20Transfer(key, to_addr);
            await nativateTansfer(key, to_addr)
            await nativateTansfer(key, to_addr, true)
            const usdc_balance = await getBalance(to_addr, Chain.Polygon, maticUsdc, 6)
            const nativate_balance = await getBalance(to_addr, Chain.Polygon)
            console.log('[%s] usdc(%s) matic(%s)', to_addr, usdc_balance.toString(), nativate_balance.toString())
        } catch (error) {
            throw error
        }
    }
    //转让代币
    // tansfer()
    //跨桥
    // await swap()
    //添加流动性／移除流动性
    // await add_liquidity()
}

async function test() {
    const usdc_balance = await getBalance('0xBa7cE7186719B90901c0687ABE5Ca0f2f36fA555', Chain.Polygon, maticUsdc, 6)
    console.log(usdc_balance)
}

// swap('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f',2)
// getBalance('0x86Fc8F04332446D5779a2bCA82D6cD50FC4e8365',Chain.Polygon,maticUsdc,6)
// fromHop()
// add_liquidity('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f', 1)
main()
// test()