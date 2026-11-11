import test from "node:test";
import assert from "node:assert/strict";
import {Account,Keypair,Networks,Operation,TransactionBuilder} from "@stellar/stellar-sdk";
import {verifyAdminWalletProof} from "./admin-wallet-proof.js";
test("admin wallet proofs bind the exact request, wallet and network and reject combined signatures",()=>{
 const a=Keypair.random(),b=Keypair.random();
 const tx=new TransactionBuilder(new Account(a.publicKey(),"0"),{fee:"100",networkPassphrase:Networks.TESTNET}).addOperation(Operation.manageData({name:"admin-link",value:"nonce-a"})).setTimeout(300).build();const canonical=tx.toXDR();tx.sign(a);verifyAdminWalletProof(canonical,tx.toXDR(),a.publicKey(),Networks.TESTNET);
 assert.throws(()=>verifyAdminWalletProof(canonical,tx.toXDR(),b.publicKey(),Networks.TESTNET));assert.throws(()=>verifyAdminWalletProof(canonical,tx.toXDR(),a.publicKey(),Networks.PUBLIC));
 const changed=new TransactionBuilder(new Account(a.publicKey(),"0"),{fee:"100",networkPassphrase:Networks.TESTNET}).addOperation(Operation.manageData({name:"admin-link",value:"nonce-b"})).setTimeout(300).build();changed.sign(a);assert.throws(()=>verifyAdminWalletProof(canonical,changed.toXDR(),a.publicKey(),Networks.TESTNET));tx.sign(b);assert.throws(()=>verifyAdminWalletProof(canonical,tx.toXDR(),a.publicKey(),Networks.TESTNET));
});
