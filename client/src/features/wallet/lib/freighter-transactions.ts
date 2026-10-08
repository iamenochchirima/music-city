import {
  Asset,
  BASE_FEE,
  Horizon,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { signWithFreighter, verifyFreighterNetwork } from "./freighter";
import { clientEnv } from "@/lib/config/env";

async function submitWithFreighter(
  accountAddress: string,
  operation:
    | ReturnType<typeof Operation.payment>
    | ReturnType<typeof Operation.changeTrust>,
) {
  await verifyFreighterNetwork();

  const server = new Horizon.Server(clientEnv.stellarHorizonUrl);
  const sourceAccount = await server.loadAccount(accountAddress);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: clientEnv.stellarNetworkPassphrase,
    timebounds: {
      minTime: 0,
      maxTime: Math.floor(Date.now() / 1000) + 180,
    },
  })
    .addOperation(operation)
    .build();
  const signedXdr = await signWithFreighter(transaction.toXDR(), accountAddress);
  const signedTransaction = TransactionBuilder.fromXDR(
    signedXdr,
    clientEnv.stellarNetworkPassphrase,
  );
  const result = await server.submitTransaction(signedTransaction);
  return result.hash;
}

export async function sendFreighterPaymentTransaction(input: {
  accountAddress: string;
  destinationAddress: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string | null;
}) {
  const asset =
    input.assetCode.toUpperCase() === "XLM" && !input.assetIssuer
      ? Asset.native()
      : input.assetIssuer
        ? new Asset(input.assetCode, input.assetIssuer)
        : null;
  if (!asset) {
    throw new Error("The selected Stellar asset is missing its issuer account");
  }

  return submitWithFreighter(
    input.accountAddress,
    Operation.payment({
      destination: input.destinationAddress,
      asset,
      amount: input.amount,
    }),
  );
}

export async function addFreighterTrustlineTransaction(input: {
  accountAddress: string;
  assetCode: string;
  assetIssuer: string;
}) {
  return submitWithFreighter(
    input.accountAddress,
    Operation.changeTrust({
      asset: new Asset(input.assetCode, input.assetIssuer),
    }),
  );
}
