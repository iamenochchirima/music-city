import { readFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import StellarHDWallet from "stellar-hd-wallet";

type CliOptions = {
  index: number;
  language: string;
  password?: string;
  inlineMnemonic?: string;
  mnemonicFile?: string;
  readFromStdin: boolean;
};

const usage = `Usage:
  pnpm --filter server treasury:derive-secret [options]

Options:
  --index <n>              Stellar account index to derive (default: 0)
  --language <name>        BIP39 wordlist language (default: english)
  --password <value>       Optional mnemonic passphrase
  --mnemonic <words...>    Pass mnemonic inline
  --mnemonic-file <path>   Read mnemonic from a local file
  --stdin                  Read mnemonic from stdin

Examples:
  pnpm --filter server treasury:derive-secret --mnemonic abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
  pnpm --filter server treasury:derive-secret --mnemonic-file .secrets/treasury.txt
  pbpaste | pnpm --filter server treasury:derive-secret --stdin
`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const parseOptions = (args: string[]): CliOptions => {
  const options: CliOptions = {
    index: 0,
    language: "english",
    readFromStdin: false,
  };
  const positionalMnemonicParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === "--index") {
      const value = args[index + 1];
      if (!value) {
        fail("Missing value for --index");
      }

      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        fail("--index must be a non-negative integer");
      }

      options.index = parsed;
      index += 1;
      continue;
    }

    if (arg === "--language") {
      const value = args[index + 1];
      if (!value) {
        fail("Missing value for --language");
      }

      options.language = value;
      index += 1;
      continue;
    }

    if (arg === "--password") {
      const value = args[index + 1];
      if (value === undefined) {
        fail("Missing value for --password");
      }

      options.password = value;
      index += 1;
      continue;
    }

    if (arg === "--mnemonic-file") {
      const value = args[index + 1];
      if (!value) {
        fail("Missing value for --mnemonic-file");
      }

      options.mnemonicFile = value;
      index += 1;
      continue;
    }

    if (arg === "--mnemonic") {
      const parts = args.slice(index + 1).filter(Boolean);
      if (parts.length === 0) {
        fail("Missing value for --mnemonic");
      }

      options.inlineMnemonic = normalizeMnemonic(parts.join(" "));
      return options;
    }

    if (arg === "--stdin") {
      options.readFromStdin = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    }

    if (arg.startsWith("-")) {
      fail(`Unknown argument: ${arg}`);
    }

    positionalMnemonicParts.push(arg);
  }

  if (positionalMnemonicParts.length > 0) {
    options.inlineMnemonic = normalizeMnemonic(positionalMnemonicParts.join(" "));
  }

  return options;
};

const normalizeMnemonic = (value: string) => value.trim().replace(/\s+/g, " ");

const deriveWallet = (
  mnemonic: string,
  password: string | undefined,
  language: string,
): StellarHDWallet => {
  try {
    return StellarHDWallet.fromMnemonic(mnemonic, password, language);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Failed to derive Stellar keypair");
    throw new Error("unreachable");
  }
};

const readMnemonicFromPrompt = async () => {
  const terminal = createInterface({ input, output });

  try {
    const answer = await terminal.question(
      "Paste the mnemonic locally and press Enter. Input will be visible on screen: ",
    );
    return normalizeMnemonic(answer);
  } finally {
    terminal.close();
  }
};

const readMnemonicFromStdin = async () => {
  let buffer = "";

  for await (const chunk of input) {
    buffer += chunk;
  }

  return normalizeMnemonic(buffer);
};

const readMnemonic = async (options: CliOptions) => {
  if (options.inlineMnemonic) {
    return options.inlineMnemonic;
  }

  if (options.mnemonicFile) {
    const fileContents = await readFile(options.mnemonicFile, "utf8");
    return normalizeMnemonic(fileContents);
  }

  if (options.readFromStdin) {
    return readMnemonicFromStdin();
  }

  return readMnemonicFromPrompt();
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2));
  const mnemonic = await readMnemonic(options);

  if (!mnemonic) {
    fail("Mnemonic is required");
  }

  const wallet = deriveWallet(mnemonic, options.password, options.language);

  const derivationPath = `m/44'/148'/${options.index}'`;
  const publicKey = wallet.getPublicKey(options.index);
  const secretKey = wallet.getSecret(options.index);

  console.log("");
  console.log(`Derivation path: ${derivationPath}`);
  console.log(`STELLAR_TREASURY_ADDRESS=${publicKey}`);
  console.log(`STELLAR_TREASURY_SECRET=${secretKey}`);
  console.log("");
  console.log(
    "Store the secret in your secret manager only. Do not place the mnemonic or S... key in git, chat, or frontend code.",
  );
};

void main();
