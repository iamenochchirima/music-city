import { readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { Keypair, Networks, Transaction, TransactionBuilder } = require("@stellar/stellar-sdk");

export const treasury = "GAGX4VX7XATS7247VUYFYDX5FZISYL3ME6SAO2MOTWVFEUVDBFQGBEB5";
export const signerKeys = [
  treasury,
  "GDYPXZHFKNTF4G3GTS7FVVIJOD3MR75HVO2O6FYCUBKODKGJVYD3PS2S",
  "GACQXEBDWTAJ3Z6CDQRQV3PC4ZCYLNXCIDXNJJMT5TGAIGEGKTOU3DIT",
];

export function reviewTransaction(xdr, expectedHash, now = Date.now(), expectedTreasury = treasury) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash ?? "")) throw new Error("Supply the exact transaction hash shown in the admin review.");
  const tx = TransactionBuilder.fromXDR(xdr.trim(), Networks.TESTNET);
  if (!(tx instanceof Transaction)) throw new Error("Fee-bump envelopes are not supported.");
  if (tx.hash().toString("hex") !== expectedHash) throw new Error("Transaction hash does not match the reviewed transaction.");
  if (tx.source !== expectedTreasury) throw new Error("Transaction source is not the verified Testnet treasury.");
  if (!tx.timeBounds || BigInt(tx.timeBounds.maxTime) === 0n || BigInt(tx.timeBounds.maxTime) * 1000n <= BigInt(now)) {
    throw new Error("Transaction expired or has no finite expiry. Prepare fresh funding in the admin UI.");
  }
  if (BigInt(tx.timeBounds.minTime) * 1000n > BigInt(now)) throw new Error("Transaction is not valid yet.");
  if (tx.signatures.length) throw new Error("Use the unsigned transaction downloaded from the admin review.");
  return tx;
}

export function verifiedSigners(state, expected = signerKeys) {
  const keys = (state.secrets ?? []).slice(0, 3).map((secret) => Keypair.fromSecret(secret));
  if (keys.length !== 3 || new Set(keys.map((key) => key.publicKey())).size !== 3 ||
      keys.some((key, index) => key.publicKey() !== expected[index])) {
    throw new Error("Saved keys do not match the verified Testnet treasury signers.");
  }
  return keys;
}

async function main() {
  const { values } = parseArgs({ options: {
    transaction: { type: "string" }, hash: { type: "string" },
    state: { type: "string" }, output: { type: "string" }, sign: { type: "boolean", default: false },
  } });
  if (!values.transaction || !values.hash || !values.state) {
    throw new Error("Usage: node scripts/review-testnet-treasury.mjs --transaction /outside/repo/unsigned.xdr --hash HASH --state /outside/repo/private-state.json [--sign --output /outside/repo/signed.xdr]");
  }
  const root = fileURLToPath(new URL("../", import.meta.url));
  function outsideRepository(path) {
    const location = resolve(path);
    const rel = relative(root, location);
    if (!rel || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) throw new Error("Keep transaction files and private state outside the repository.");
    return location;
  }
  const statePath = outsideRepository(values.state);
  const stateInfo = await stat(statePath);
  if (stateInfo.mode & 0o077) throw new Error("Private state must be accessible only to its owner, mode 600.");
  const transactionPath = outsideRepository(values.transaction);
  const tx = reviewTransaction(await readFile(transactionPath, "utf8"), values.hash);
  const keys = verifiedSigners(JSON.parse(await readFile(statePath, "utf8")));
  console.log(JSON.stringify({
    network: Networks.TESTNET, hash: tx.hash().toString("hex"), source: tx.source,
    expiresAt: new Date(Number(tx.timeBounds.maxTime) * 1000).toISOString(),
    feeStroops: tx.fee, operationTypes: tx.operations.map((op) => op.type),
    signers: keys.map((key) => key.publicKey()),
  }, null, 2));
  if (!values.sign) {
    console.log("Review only. No signatures created. Run with --sign --output PATH only after checking the admin transaction evidence.");
    return;
  }
  if (!values.output) throw new Error("Signing requires an output path.");
  const output = outsideRepository(values.output);
  tx.sign(keys[0], keys[1]);
  await writeFile(output, tx.toXDR() + "\n", { mode: 0o600, flag: "wx" });
  console.log(`Saved two Testnet signatures to ${output}. Nothing was submitted. Paste this signed XDR into the admin review for verification.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("Treasury review failed. Check the file paths, permissions, expected hash, expiry, and signer state. No transaction was submitted.");
    process.exitCode = 1;
  });
}
