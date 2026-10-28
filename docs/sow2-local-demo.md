# Demonstrate the SOW 2 earnings lifecycle locally

This guide follows the creator-to-purchase-to-claim journey recorded in [E8](core-lifecycle-evidence/README.md). E8 is historical evidence from 17 October 2026. A new demonstration needs new transactions and its own evidence. Reviewer acceptance and the rollout of the current checkout remain open in the [SOW 2 tracker](sow-2-tracker.md).

## Prepare the local environment

1. Use an isolated local PostgreSQL database and local application configuration. Confirm that the API, client, admin and financial worker use Stellar Testnet and the same Testnet USDC issuer, agreement registry and settlement contracts. Do not point the demo at production data.
2. Prepare two Dynamic Sandbox users with Stellar Testnet wallets. One acts as artist; the other can act as both contributor and buyer, as in E8. Both beneficiaries need a USDC trustline and sufficient XLM for network fees. The buyer also needs Testnet USDC.
3. Prepare an administrator account and three independent Testnet treasury signers. The configured treasury and contracts must require two signatures. Keep wallet keys and admin credentials out of screenshots, shared documents and logs.
4. From the repository root, build the shared package and start the services in separate terminals:

   ```sh
   pnpm --filter @music-city/shared build
   pnpm dev:server
   pnpm dev:worker
   pnpm dev:financial-worker
   pnpm dev:client
   pnpm dev:admin
   ```

   The default addresses are `http://localhost:4317` for the client, `http://localhost:4318` for the admin and `http://localhost:4319` for the API. Local configuration can change them. The media worker processes uploads; the financial worker reconciles payments, settlements and claims.
5. Confirm that the API readiness endpoint at `/api/v1/health/ready` responds successfully and that both frontends load against the local API. Record the current Git revision with `git rev-parse HEAD`.

## Publish music and approve the agreement

1. Sign in as the artist, create a release and upload a short audio file you are allowed to use. Wait for processing and publish the release. Record the release and recording IDs.
2. In **Royalty agreements**, create a proposal for that recording. Use the artist and contributor as beneficiaries and enter a 70/30 split. Both accounts must sign the same proposal through their Dynamic wallets.
3. In the local admin's **Agreements** page, review the accepted proposal and finalize it with two distinct treasury signatures. Confirm the resulting registry transaction on Stellar Testnet and record the agreement version and hash.
4. In the artist's recording settings, enable a sale price of 0.001 USDC. Use a new recording or a buyer who has not already purchased it.

## Buy, settle and claim

1. Sign in as the buyer and open the published recording. Review the 0.001 USDC purchase, authorize it in the connected wallet and wait for confirmation. Confirm the recording shows **Purchased** and record the purchase transaction hash.
2. In the local admin's royalty ledger at `/console/royalties`, find the purchase and use **Approve source earnings**. In **Settlements**, select that approved source and enter a future claim deadline in UTC. Use **Review allocations**, verify the 70/30 amounts and select **Reserve reviewed earnings**.
3. Use **Prepare treasury funding**. Obtain signatures from two different authorized treasury signers for the exact prepared transaction. Add both signatures and use **Submit authorized transaction**. Confirm the funding receipt and record the batch ID and transaction hash.
4. Sign in as each beneficiary and open **Revenue**. Claim the available amount through that beneficiary's Dynamic wallet. Wait for confirmation and record both claim transaction hashes.
5. Return to **Settlements**. Confirm the batch is closed, both allocations are paid and the reconciliation report agrees with the receipts. Compare the purchase, funding and claim transactions with Stellar Testnet independently. The claims are contract-managed; do not describe them as native Stellar claimable balances.

## Record the result

Save the Git revision, local environment, date, agreement and batch identifiers, Testnet transaction hashes, reconciliation results and screenshots without credentials. Record any skipped step or failure. The [E8 evidence package](core-lifecycle-evidence/README.md) shows the earlier expected receipts, interruption checks and limitations; its transaction IDs are not evidence of a new run.

The MoonPay and MoneyGram sandbox flows are separate from this demonstration. A provider link, a simulated response or an XLM test does not demonstrate a completed USDC on-ramp or cash-out. The current provider routes remain disabled pending verified provider outcomes.
