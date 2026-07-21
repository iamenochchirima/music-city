# Music City Demo and Evidence Capture Checklist

Target recording length: 3–5 minutes. Use test accounts and Stellar Testnet only. Never display a seed phrase, secret key, `.env` file, database URL, API key, or private admin password.

## Before recording

- [ ] Deploy the exact commit being submitted and record its full Git hash.
- [ ] Confirm client, API, and admin URLs work in a private/logged-out browser window.
- [ ] Prepare one artist wallet, one listener wallet, one treasury wallet, and at least one payout recipient on testnet.
- [ ] Fund the wallets with test XLM and the intended test USDC asset.
- [ ] Prepare one short audio sample that the builder has permission to demonstrate.
- [ ] Create a two-recipient split whose shares visibly total 10,000 basis points.
- [ ] Open the Soroban contract and Stellar payment explorer pages in separate tabs.
- [ ] Remove personal notifications and unrelated browser tabs from the recording.

## Recording sequence

1. Show the Music City landing page and state the problem in one sentence.
2. Connect the artist's Stellar wallet and show the artist profile.
3. Create or open a track and show its two royalty recipients and exact percentages.
4. Publish the approved split to Soroban from the admin workflow.
5. Open the transaction link and contract ID in the Stellar explorer.
6. Return to Music City and run the read-back verification; show that off-chain and on-chain versions match.
7. Connect the listener wallet, show subscription/access status, and play enough of the track to create a qualified stream.
8. Show the royalty ledger entry or allocation in the admin interface.
9. Approve and execute a small testnet USDC payout.
10. Open the payment transaction in the explorer and point out the asset, amount, sender, recipient, success status, and timestamp.
11. Finish on the repository commit and the evidence index.

## Screenshots to export

- [ ] Artist profile with connected public wallet address.
- [ ] Track metadata and royalty recipients totaling 100%.
- [ ] Soroban publish success with contract ID and transaction hash.
- [ ] Soroban read-back showing a matching active version.
- [ ] Listener subscription/access state.
- [ ] Qualified stream or royalty ledger entry.
- [ ] Payout approval and submitted/confirmed state.
- [ ] Stellar explorer payment details.
- [ ] Passing contract tests and application test summary.

## Final evidence naming

Use stable names so the Chapter Lead can match files quickly:

- `music-city-instaward-demo.mp4`
- `01-artist-wallet.png`
- `02-track-splits.png`
- `03-soroban-publish.png`
- `04-soroban-verify.png`
- `05-qualified-stream-ledger.png`
- `06-testnet-usdc-payout.png`
- `test-results.txt`
- `contract-id.txt`
- `submission-commit.txt`

## Final verification

- [ ] Every link opens without the builder's browser session.
- [ ] Explorer links use testnet, not mainnet.
- [ ] The transaction shown is produced by the submitted Music City flow.
- [ ] The demo claims match the agreed Statement of Work exactly.
- [ ] No secret or personal identity document is visible.
- [ ] The Chapter Lead can verify each deliverable in under five minutes.
