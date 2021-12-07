require('dotenv').config()
const { AMM, Hop, Chain, Token } = require('@hop-protocol/sdk')
const { Wallet, providers, BigNumber, constants } = require('ethers')
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
const matic_liqulity = '0x5C32143C8B198F392d01f8446b754c181224ac26';
const amountToApprove = constants.MaxUint256


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

async function wait_tx_ok(url, hash) {
    const web3 = new Web3(url);
    while (1) {
        val = await web3.eth.getTransactionReceipt(hash)

        if (val != null) {

            console.log(hash, val.status)
            break

        }
        await wait(1000)
    }
}


async function send(privateKey, ismatic = true, amount = 0) {
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
        var sourceChain = Chain.Polygon
        var balance = await getBalance(signer.address, Chain.Polygon, maticUsdc, 6)
    }
    else {
        var sourceChain = Chain.xDai
        var balance = await getBalance(signer.address, Chain.xDai, xdaiUsdc, 6)
    }
    const decimals = 6
    const amount_s = util.format('%s', 12);
    const amountBN = parseUnits(amount_s, decimals)
    if (balance.lt(BigNumber.from(amountBN))) {
        console.log('ignore:', signer.address)
        return
    }
    ammWrapper = await bridge.getAmmWrapper(sourceChain, signer);
    const l2CanonicalToken = bridge.getCanonicalToken(sourceChain);
    const allowance = await l2CanonicalToken.allowance(ammWrapper.address);

    if (allowance.lt(BigNumber.from(amountBN))) {
        // throw new Error('not enough allowance');
        try {
            const tx = await l2CanonicalToken.approve(ammWrapper.address, amountToApprove);
            // await (tx === null || tx === void 0 ? void 0 : tx.wait());
            await wait_tx_ok(url, tx.hash)
        } catch (error) {
            console.log(`approve:${error}`);
            await send(privateKey, ismatic, amount)
        }

    }

    if (ismatic) {
        try {
            const tx = await bridge.send(amountBN, Chain.Polygon, Chain.xDai)
            console.log('send from matic:', tx.hash)
            await wait_tx_ok(url, tx.hash)
        } catch (error) {
            console.log(`matic send:${error}`);
            await send(privateKey, ismatic, amount)
        }



    } else {
        try {
            let amountBN1 = await getBalance(signer.address, Chain.xDai, xdaiUsdc, 6)
            let tx2 = await bridge.send(amountBN1, Chain.xDai, Chain.Polygon);
            console.log('send from xdai', tx2.hash);
            await wait_tx_ok(url, tx2.hash)
        } catch (error) {
            console.log(`xdai send:${error}`);
            await send(privateKey, ismatic, amount)
        }

    }

}

async function swap(privateKey, amount) {
    // const privateKey = process.env.PRIVATE_KEY
    for (let i = 0; i < 3; i++) {
        await send(privateKey, true, amount)

    }
    await wait(500000)
    await send(privateKey, false)
    await wait(500000)
}

async function erc20Transfer(from_key, to_addr, amount = 0) {
    const maticurl = "https://rpc-mainnet.matic.quiknode.pro";
    const maticchainid = 0x89;
    const provider = new HDWalletProvider(from_key, maticurl)
    const web3 = new Web3(provider);
    const signer = new Wallet(from_key);
    var _from = signer.address;
    if (amount > 0) {
        const decimals = 6
        const amount_s = util.format('%s', amount);
        const amountBN = parseUnits(amount_s, decimals)
        var balance = amountBN;
    } else {
        var balance = await getBalance(_from, Chain.Polygon, maticUsdc, 6);
    }
    const decimals = 6
    const amount_s = util.format('%s', 1);
    const amountBN = parseUnits(amount_s, decimals)
    if (balance.lt(BigNumber.from(amountBN))) {
        console.log('erc20transfer ignore:', signer.address)
        return
    }
    // var privateKey = Buffer.from(from_key, 'hex');
    const matic_contract = new web3.eth.Contract(erc20TransferAbi, maticUsdc)
    try {
        const tx = await matic_contract.methods.transfer(to_addr, balance.toString()).send({ from: _from })
        console.log('erc20transfer:', tx.transactionHash)
        await wait_tx_ok(maticurl, tx.transactionHash)
    } catch (err) {
        throw new Error('erc20Transfer:%s' % err);
    }


}


async function nativateTansfer(from_key, to_addr, ismatic = false) {
    //将from的原生代币和usdc全部转给to地址　先转usdc再转原生代币（手续费）
    const xdaiurl = 'https://rpc.xdaichain.com/';
    const xdaichainid = 0x64;
    const maticurl = "https://rpc-mainnet.matic.quiknode.pro";
    const maticchainid = 0x89;
    const fee = 0.0015 * (Math.pow(10, 18));
    if (ismatic) {
        var url = maticurl;
        var web3 = new Web3(maticurl);
        var gasprice = web3.utils.toHex(web3.utils.toWei('30', 'gwei'))
        const signer = new Wallet(from_key);
        var _from = signer.address;
        var balance = await getBalance(_from, Chain.Polygon)
        var amount = balance - fee;
        var chainid = maticchainid;

    } else {
        var url = xdaiurl;
        var web3 = new Web3(xdaiurl);
        var gasprice = web3.utils.toHex(web3.utils.toWei('3', 'gwei'))
        const signer = new Wallet(from_key);
        var _from = signer.address;
        var balance = await getBalance(_from, Chain.xDai)
        var amount = balance - fee;
        var chainid = xdaichainid;
    }
    const decimals = 18
    const amount_s = util.format('%s', 0.5);
    const amountBN = parseUnits(amount_s, decimals)
    if (balance.lt(BigNumber.from(amountBN))) {
        console.log('nativatetransfer ignore:', signer.address)
        return
    }
    var privateKey = Buffer.from(from_key, 'hex');//process.env.PRIVATE_KEY_1
    try {
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

            web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'), async function (err, hash) {
                if (!err) {
                    console.log('nativate_transfer:', hash);
                    await wait_tx_ok(url, hash)
                } else {
                    throw err
                }
            })
        });
    } catch (error) {
        throw new Error(`nativateTansfer:${error}`);
    }



}



async function add_remove_liquidity(privateKey, amount) {
    const url = 'https://polygon-rpc.com'
    const provider = new providers.JsonRpcProvider(url)
    const signer = new Wallet(privateKey, provider)
    const hop = new Hop('mainnet', signer)
    const bridge = hop.connect(signer).bridge('USDC')
    var sourceChain = Chain.Polygon
    const decimals = 6
    const amount_s = util.format('%s', amount);
    const amountBN = parseUnits(amount_s, decimals)
    const l2CanonicalToken = bridge.getCanonicalToken(sourceChain);
    const allowance = await l2CanonicalToken.allowance(matic_liqulity);
    if (amount < 20) {
        return
    }
    if (allowance.lt(BigNumber.from(amountBN))) {
        try {
            const tx = await l2CanonicalToken.approve(matic_liqulity, amountToApprove);
            await wait_tx_ok(url, tx.hash);
        } catch (error) {
            await add_remove_liquidity(privateKey, amount)
        }

    }
    try {
        const tx = await bridge.addLiquidity(amountBN, '0', Chain.Polygon);
        console.log('add_liquidity:', tx.hash);
        await wait_tx_ok(url, tx.hash);
    } catch (error) {
        console.log(`addLiquidity:${error}`);
    }

    let amountlp = await getBalance(signer.address, Chain.Polygon, usdcLp, 6);
    const lpToken = await bridge.getSaddleLpToken(Chain.Polygon)
    const allowance1 = await lpToken.allowance(matic_liqulity)
    if (allowance1.lt(BigNumber.from(amountlp))) {
        // throw new Error('not enough allowance');
        try {
            const tx = await lpToken.approve(matic_liqulity, amountToApprove);
            await wait_tx_ok(url, tx.hash);
        } catch (error) {
            await add_remove_liquidity(privateKey, amount)
        }
    }
    try {
        let tx1 = await bridge.removeLiquidityOneToken(amountlp, 0, Chain.Polygon)
        console.log('remove_liquidity:', tx1.hash)
        await wait_tx_ok(url, tx1.hash);
    } catch (error) {
        throw new Error(`removeLiquidityOneToken:${error}`);
    }

}


async function once(lines, num) {

    for (var i = 0; i < lines.length; i++) {
        let item = lines[i];
        let line = item.split(" ");
        let addr = line[0];
        let key = line[1];
        let item2 = lines[i + 1];
        let to_addr = item2.split(" ")[0];

        try {
            await swap(key, 12);
            await add_remove_liquidity(key, 20);
            await erc20Transfer(key, to_addr);
            await nativateTansfer(key, to_addr)
            await nativateTansfer(key, to_addr, true)

        } catch (error) {
            console.log(num, i)
            throw error
        }
    }

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
    var line5 = lines.slice(172, 212);
    var res = [line1, line2, line3, line4, line5];
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
            try {
                await once(res[i], i)
            } catch (error) {

                console.log(i, error)
            }

        }, 1)
    }

}
// 函数实现，参数单位 毫秒 ；
function wait(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
};


async function test(privateKey, ismatic = true, amount = 0) {
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
        var sourceChain = Chain.Polygon
        var balance = await getBalance(signer.address, Chain.Polygon, maticUsdc, 6)
    }
    else {
        var sourceChain = Chain.xDai
        var balance = await getBalance(signer.address, Chain.xDai, xdaiUsdc, 6)
    }
    const decimals = 6
    const amount_s = util.format('%s', amount);
    const amountBN = parseUnits(amount_s, decimals)
    if (balance.lt(BigNumber.from(amountBN))) {
        console.log(balance.toString(), amountBN.toString())
        return
    }


}
// swap('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f',2)
// getBalance('0x86Fc8F04332446D5779a2bCA82D6cD50FC4e8365',Chain.Polygon,maticUsdc,6)
// fromHop()
// add_remove_liquidity('b4f490811d5fb27c71910014564d1391857a7c456d07c9bfc0ced867bd296d46', 1)
main()
// erc20Transfer('b4f490811d5fb27c71910014564d1391857a7c456d07c9bfc0ced867bd296d46','0xBa7cE7186719B90901c0687ABE5Ca0f2f36fA555',1)
// nativateTansfer('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f','0x0aAa1Cbcc180Cfe4099a7e749be2b6A37F5edFB2',true)
// send('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f', false)
// test('57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f',false,10)