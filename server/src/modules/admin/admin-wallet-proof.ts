import {Transaction,TransactionBuilder,Keypair} from "@stellar/stellar-sdk";
import {HttpError} from "../../utils/http-error.js";
export function verifyAdminWalletProof(transaction:string,signed:string,wallet:string,network:string){
 try {const expected=TransactionBuilder.fromXDR(transaction,network),actual=TransactionBuilder.fromXDR(signed,network);
  if(!(expected instanceof Transaction)||!(actual instanceof Transaction)||!actual.hash().equals(expected.hash())||actual.signatures.length!==1||!Keypair.fromPublicKey(wallet).verify(actual.hash(),actual.signatures[0]!.signature()))throw Error();
  return actual;
 }catch{throw new HttpError(403,"Sign the exact request with your own connected wallet");}
}
