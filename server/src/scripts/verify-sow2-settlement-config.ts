import { settlementChain } from "../modules/settlements/settlement-chain.js";

try {
  const config = settlementChain.config();
  const evidence = await settlementChain.verifyConfiguration(config);
  console.log("SOW 2 Stellar Testnet settlement configuration verified.");
  console.log(`Treasury: ${config.treasuryAddress}`);
  console.log(`Registry: ${config.registryId}`);
  console.log(`Settlement contract: ${config.contractId}`);
  console.log(`Deployment ledger: ${settlementChain.eventStartLedger()}`);
  console.log(`Treasury threshold: ${evidence.threshold}-of-3`);
} catch (error) {
  console.error(
    error instanceof Error
      ? `SOW 2 settlement configuration check failed: ${error.message}`
      : "SOW 2 settlement configuration check failed.",
  );
  process.exitCode = 1;
}
