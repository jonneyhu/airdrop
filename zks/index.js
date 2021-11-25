import { ethers } from "ethers";
import * as zksync from "zksync";


const syncProvider = zksync.getDefaultProvider("rinkeby");
const ethersProvider = ethers.getDefaultProvider("rinkeby");
// 创建钱包
const privateKey = '57481c46d76379892a8e9ab74c44b5694850c442ee33ff7ff13fe8e1c63a915f';
const ethWallet = new ethers.Wallet(privateKey).connect(ethersProvider);
const syncWallet = zksync.wallet.fromEthSigner(ethWallet,syncProvider);
console.log(ethWallet.address);

// 将资产冲以太坊存入zksync

// const deposit = await syncWallet.depositToSyncFromEthereum({
//     depositTo:syncWallet.address(),
//     token: "ETH",
//     amount: ethers.utils.parseEther("1.0")
// });
// const depositReceipt = await deposit.awaitReceipt();
// console.log(depositReceipt)
// const depositReceipt = await deposit.awaitVerifyReceipt();

// 解锁zksync账户

// if (!(await syncWallet.isSigningKeySet())){
//     if ((await syncWallet.getAccountId()) == undefined){
//         throw new Error("unknow account");
//     }

//     const changePubkey = await syncWallet.setSigningKey({
//         feeToken:"ETH",
//         ethAuthType:"ECDSA",
//     });
//     // Wait until the tx is committed
//     await changePubkey.awaitReceipt()    
// }

// 查看zksync账户余额
// Committed state is not final yet
// const committedETHBalance = await syncWallet.getBalance("ETH");
// Verified state is final
// const verifiedEthBalance = await syncWallet.getBalance("ETH","verified");
// console.log(committedETHBalance,verifiedEthBalance)
// 进行转账
// const amount = zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther("0.999"));
// const fee = zksync.utils.closestPackableTransactionFee(ethers.utils.parseEther("0.001"));

// const transfer = await syncWallet.syncTransfer({
//   to: syncWallet2.address(),
//   token: "ETH",
//   amount,
//   fee,
// });
// const transferReceipt = await transfer.awaitReceipt();