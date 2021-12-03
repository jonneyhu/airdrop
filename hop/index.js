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


async function send(privateKey,ismatic = true, amount=0) {
    if (ismatic) {
        var url = 'https://polygon-rpc.com';
    } else {
        var url = 'https://rpc.xdaichain.com/';
    }

    const provider = new providers.JsonRpcProvider(url)
    const signer = new Wallet(privateKey, provider)
    const hop = new Hop('mainnet', signer)
    const bridge = hop.connect(signer).bridge('USDC')

    if (ismatic) {
        const decimals = 6
        const amount_s = util.format('%s', amount);
        const amountBN = parseUnits(amount_s, decimals)
        const tx = await bridge.send(amountBN, Chain.Polygon, Chain.xDai)
        console.log('send from matic:', tx.hash)
    } else {
        let amountBN1 = await getBalance(signer.address, Chain.xDai, xdaiUsdc, 6)
        let tx2 = await bridge.send(amountBN1, Chain.xDai, Chain.Polygon);
        console.log('send from xdai', tx2.hash);
    }

}

async function swap(privateKey, amount) {
    // const privateKey = process.env.PRIVATE_KEY
    for(let i=0;i<5;i++){
        await send(privateKey,true,amount)
    }
    sleep(300000)
    await send(privateKey,false)
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
    sleep(20000)
    let amountlp = await getBalance(signer.address, Chain.Polygon, usdcLp, 6);
    let tx1 = await bridge.removeLiquidityOneToken(amountlp, 0, Chain.Polygon)
    console.log('remove_liquidity:', tx1.hash)

}


async function once(lines) {
    // let data = fs.readFileSync("key.txt", "utf-8");
    // const lines = data.split(/\r?\n/);

    for (var i = 0; i < lines.length; i++) {
        if(i==1){
            break
        }
        let item = lines[i];
        let line = item.split(" ");
        let addr = line[0];
        let key = line[1];
        let item2 = lines[i + 1];
        let to_addr = item2.split(" ")[0];
        console.log(addr,to_addr)
        const usdc_balance = await getBalance(addr, Chain.Polygon, maticUsdc, 6)
        const nativate_balance = await getBalance(addr, Chain.Polygon)
        console.log('[%s] usdc(%s) matic(%s)', addr, usdc_balance.toString(), nativate_balance.toString())
        // 先完成垮桥，然后添加流动性，移除流动性，最后将代币转移到下一个地址
        try {
            await swap(key, 12);
            sleep(300000)
            await add_remove_liquidity(key, 20);
            sleep(20000)
            await erc20Transfer(key, to_addr);
            sleep(20000)
            await nativateTansfer(key, to_addr)
            sleep(20000)
            await nativateTansfer(key, to_addr, true)
            const usdc_balance = await getBalance(to_addr, Chain.Polygon, maticUsdc, 6)
            const nativate_balance = await getBalance(to_addr, Chain.Polygon)
            console.log('[%s] usdc(%s) matic(%s)', to_addr, usdc_balance.toString(), nativate_balance.toString())
        } catch (error) {
            console.log(i)
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

function sleep(delay) {
    for (let t = Date.now(); Date.now() - t <= delay;);
}

async function main() {
    let data = fs.readFileSync("key.txt", "utf-8");
    const lines = data.split(/\r?\n/);
    var line1 = lines.slice(12, 52);
    var line2 = lines.slice(52, 92);
    var line3 = lines.slice(92, 132);
    var line4 = lines.slice(132, 172);
    var line5 = lines.slice(172,212);
    var res = [line1, line2, line3, line4,line5];
    var initial = [
        '0xBa7cE7186719B90901c0687ABE5Ca0f2f36fA555 57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f',
        '0x86Fc8F04332446D5779a2bCA82D6cD50FC4e8365 70e5fbb405e7efabc47d678f3454555ae9b968fa119d8122fd5a2000eba2100d',
        '0xf4bcCeACcFE4a32B72715BaC6337DB63F6e07869 cc042762a0cfd5a25595bb1f6abc266d8048ab6b432a30a96db3f0e23857f628',
        '0x1714eF9f6392ca42D069AD7F46Cd63B2bc183764 3fe98e7c9017a295b0c6236715b66d56839d482968425b5527fffc39ab1e16d6',
        '0x0aAa1Cbcc180Cfe4099a7e749be2b6A37F5edFB2 b4f490811d5fb27c71910014564d1391857a7c456d07c9bfc0ced867bd296d46'
    ]
    for (let i = 0; i < res.length; i++) {
        res[i].unshift(initial[i]);

        setTimeout(async function () {
            try{
                await once(res[i])
            }catch(error){
                console.log('line:',i)
                throw error
            }
            
        }, 1)
    }

}

async function test(){
    await send('b4f490811d5fb27c71910014564d1391857a7c456d07c9bfc0ced867bd296d46',true,2)
}
// swap('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f',2)
// getBalance('0x86Fc8F04332446D5779a2bCA82D6cD50FC4e8365',Chain.Polygon,maticUsdc,6)
// fromHop()
// add_liquidity('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f', 1)
// main()
test()