## Specific Stellar Functionality Being Built or Improved

### Existing Music City Capabilities Used

The Instaward will use the following existing Music City capabilities as its product and integration foundation:

- artist, track, and release records;
- music upload, media processing, and streaming;
- qualified-stream tracking;
- backend royalty ledger and split management;
- subscription and purchase payment flows;
- admin royalty approval and payout controls;
- Stellar wallet authentication;
- Stellar Testnet USDC payments and payout reconciliation;
- the existing Soroban royalty-split registry;
- existing marketplace and wallet-based content-access interfaces.

### Instaward Additions and Improvements

The Instaward will extend this foundation with:

- a Soroban royalty-settlement contract for aggregated earnings batches;
- creator and contributor claim flows using Stellar wallets;
- authorization controls for administrators, artists, contributors, and collectors;
- on-chain validation of royalty allocations, recipient wallets, payout assets, prices, and edition supplies;
- duplicate-settlement, replay, and double-claim protection;
- controlled edition minting with fixed supply limits;
- contract events for settlements, claims, purchases, mints, and transfers;
- Stellar USDC settlement records and transaction verification;
- a separate marketplace for limited on-chain music editions;
- fixed-price USDC purchases, Soroban minting, contributor proceeds, and wallet-based content access;
- secure handling of treasury credentials and exclusion of private keys, personal data, and audio files from on-chain storage;
- automated contract, backend, integration, and end-to-end Testnet testing;
- failure testing for unauthorized calls, invalid splits, duplicate claims, rejected transactions, insufficient balances, and mismatched on-chain records;
- backend, admin, and creator interfaces for these new workflows;
- documented deployment, test results, transaction hashes, explorer links, and end-to-end verification evidence.

The royalty settlement layer is the core Stellar infrastructure; the marketplace is a new product feature built on top of it. The work will be developed and verified on Stellar Testnet using USDC, fixed-price primary sales, and aggregated royalty settlement. After the sprint, the crypto payout workflow will be ready to move into production once the normal mainnet deployment and operational checks are completed. Fiat payouts may take longer because they depend on the separate business onboarding and compliance processes of Yellow Card and MoneyGram. The scope will not include secondary marketplaces, copyright transfers, fractional royalty investments, cross-chain functionality, or per-stream blockchain transactions.

## Stellar Component of the Creator Earnings, Royalty, and Payout Workflow

Music City will use Stellar and Soroban as the verifiable settlement and payout layer for creator earnings.

Qualified streams, subscriptions, and music purchases will continue to be recorded and calculated in Music City's backend. At the end of an accounting batch, the backend will submit an aggregated royalty settlement to the Soroban contract. This accounting batch is separate from the creator's withdrawal timing; creators will not need to wait for a scheduled payout period once their balance becomes claimable.

The Soroban contract will:

- validate the track's registered royalty split and recipient wallets;
- prevent duplicate settlement batches and double allocation;
- credit each creator or contributor with a claimable Stellar USDC balance;
- enforce minimum withdrawal thresholds;
- authorize creator-initiated claims through Stellar wallets;
- transfer USDC to the recipient's Stellar wallet;
- emit settlement, claim, and payout events;
- store transaction references for independent verification.

### Crypto Withdrawals on Stellar

When a creator's claimable balance reaches the configured minimum threshold, the creator may initiate a withdrawal at any time. The creator signs the claim using their Stellar wallet, and the Soroban contract verifies the request, deducts the claimed amount, and transfers the corresponding USDC directly to the creator's Stellar address.

These withdrawals will not require individual administrator approval. The smart contract will control authorization, thresholds, balance deductions, and duplicate-claim protection.

### Fiat Withdrawals Through a Stellar Anchor

Creators who prefer fiat may select a fiat withdrawal instead. Music City will build the payout connections while onboarding with two provider targets in parallel:

- [Yellow Card's B2B Payments API](https://docs.yellowcard.engineering/docs/buy-sell-digital-assets) for African corridors, including ZAR bank payouts in South Africa and KES bank or mobile-money payouts in Kenya;
- [MoneyGram Ramps](https://developer.moneygram.com/moneygram-developer/docs/integrate-moneygram-ramps) for international corridors through Stellar's SEP-24 standard, with the available payout method determined by the destination country.

SEP-24 will be used specifically for the MoneyGram integration. It supports an embedded anchor-hosted flow for KYC, payout verification, and conversion between Stellar assets and traditional financial rails. The anchor or payout provider will complete KYC and verify the creator's bank, mobile-money, or cash-pickup details.

The fiat process will be:

1. The creator requests a fiat withdrawal after reaching the required threshold.
2. The Soroban contract reserves the equivalent claimable USDC balance.
3. The Stellar anchor completes KYC and verifies the creator's payout details.
4. The authorized payout flow releases the reserved USDC to the anchor's Stellar account.
5. The anchor converts the USDC into local currency and delivers it to the creator.
6. The anchor's status and the Stellar transaction hash are recorded in Music City.
7. If the payout fails, the reserved balance is returned to the creator's available balance.

Music City will not manually approve ordinary crypto withdrawals or act as the fiat provider. The smart contract will control the on-chain balance and USDC settlement, while the selected provider will handle fiat conversion, KYC, and delivery through the applicable financial rails. This follows Stellar's [anchor model](https://developers.stellar.org/docs/learn/fundamentals/anchors) for connecting on-chain assets to traditional payment systems.

The two payout options will not necessarily be available at the same time. The crypto payout flow is being built entirely within Music City’s Stellar and Soroban infrastructure, so it will be ready for production after the sprint once the contract is deployed to mainnet and the final operational checks are complete.

Fiat payouts are different. Music City can build and test the integration during the sprint, but actual fiat conversion and delivery will depend on Yellow Card and MoneyGram completing their business onboarding, compliance review, corridor approval, and production access requirements. Until those approvals are complete, the fiat flow will run against sandbox or Testnet environments and will not be presented as a live production payout service.

### Fiat-to-USDC On-Ramping

Listeners and collectors who do not already hold USDC will be able to use an embedded on-ramp to fund their Stellar wallet.

The user will select a local payment method, complete the provider's required verification, receive a conversion quote, and pay using local fiat. The provider will convert the payment into Stellar USDC and send it to the user's wallet. The user can then use that USDC to purchase limited music editions or access other supported Music City products.

Yellow Card will be the initial provider target for African payment methods, while MoneyGram SEP-24 will support international on-ramp access where available.

For marketplace customers:

> local fiat → Yellow Card or MoneyGram on-ramp → Stellar USDC → music-edition purchase → Soroban ownership record → contributor proceeds

This creates the complete workflow:

> qualified usage → aggregated royalty settlement → Soroban allocation → creator claim → Stellar USDC payment or anchor-based fiat payout

The Instaward will fund the Soroban settlement and claim infrastructure, wallet and payout integrations, and the security and verification work required to make creator earnings auditable and claimable on Stellar.

## Budget Allocation

The Instaward funding will be used only for technical and product execution. It will not fund marketing, paid user acquisition, promotional campaigns, incentives, provider transaction fees, compliance fees, or fiat payout funds.

| Technical deliverable | Amount |
| --- | ---: |
| Soroban royalty settlement and crypto withdrawals | $1,400 |
| On-chain music editions marketplace | $1,000 |
| Fiat payout integrations | $750 |
| Fiat on-ramp integrations | $550 |
| Backend, admin, creator interfaces, and reconciliation | $500 |
| Security, testing, and failure handling | $500 |
| Deployment, documentation, and evidence packaging | $300 |
| **Total** | **$5,000** |
