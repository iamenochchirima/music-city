# Local Testnet treasury signing

The saved test keys are in `/home/enock/.local/state/music-city/settlement-demo-final/private-state.json`, under `secrets[0]`, `secrets[1]`, and `secrets[2]`. The file has mode 600. A read-only derivation on 29 October matched all three public keys to Horizon's signer list for treasury `GAGX4VX7XATS7247VUYFYDX5FZISYL3ME6SAO2MOTWVFEUVDBFQGBEB5`. Each has weight one; all account thresholds are two. These are the historical E8 generated Testnet keys, separate from Dynamic user wallets. Do not paste or commit the private state.

`scripts/review-testnet-treasury.mjs` reviews a downloaded unsigned transaction using only Stellar Testnet's network passphrase. It checks the exact independently supplied transaction hash, treasury source, finite unexpired time bounds, absence of existing signatures, private-file permissions, and all three saved public keys. It loads no application environment, connects to no database or provider, and submits nothing. Review mode creates no signatures. With `--sign`, the operator explicitly signs with the first two verified test keys and writes a new mode-600 XDR file outside the repository. Existing output files cannot be overwritten.

From the repository root, first review a fresh transaction downloaded from the local admin's Treasury Funding panel:

```sh
node scripts/review-testnet-treasury.mjs \
  --transaction /absolute/path/to/unsigned.xdr \
  --hash HASH_FROM_THE_ADMIN_TRANSACTION_EVIDENCE \
  --state /home/enock/.local/state/music-city/settlement-demo-final/private-state.json
```

After comparing the hash and transaction evidence, an authorized local CLI operator can repeat the command with `--sign --output /absolute/path/to/signed.xdr`. Add the signed file's contents through the matching authenticated signature endpoint, or paste it into the admin review. Verify both signatures before submitting the prepared attempt. Browser wallet transactions retain their separate handoff requirement. Do not share private keys or use the full demo script, which starts a separate demonstration lifecycle.

For current purchase `pay_28e833aeedf04b8f`, a convenience command was prepared outside the repository at `/home/enock/.local/state/music-city/core-lifecycle/sign-current-qa-funding.sh`. It binds hash `08463be28b263a0677607d4c493f69073135fd8ef2036c559a6b1f9cfcc39d36`, signs only when the operator runs it, and does not submit. That transaction expires at 12:08:36 SAST on 29 October 2026. After expiry, prepare a fresh attempt and refresh both the unsigned file and expected hash. The script deliberately refuses an expired attempt.

Verification: four focused tests pass for unsigned-envelope preservation, changed hash/source/network rejection, expiry and signed-envelope rejection, and distinct matching signer keys. The actual envelope first passed review-only mode. After the user explicitly authorized running the CLI commands, two signatures were created, verified by the local API, and submitted once. Horizon confirmed funding in ledger 5448972. See the [funding evidence](current-qa-funded-2026-10-29.json). This original envelope is now consumed and must not be rerun.
