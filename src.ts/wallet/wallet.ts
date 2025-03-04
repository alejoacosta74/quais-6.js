import { SigningKey } from "../crypto/index.js";
import { assertArgument } from "../utils/index.js";

import { BaseWallet } from "./base-wallet.js";
import { HDNodeWallet } from "./hdwallet.js";
import { decryptCrowdsaleJson, isCrowdsaleJson  } from "./json-crowdsale.js";
import {
    decryptKeystoreJson, decryptKeystoreJsonSync,
    encryptKeystoreJson, encryptKeystoreJsonSync,
    isKeystoreJson
} from "./json-keystore.js";
import { Mnemonic } from "./mnemonic.js";

import type { ProgressCallback } from "../crypto/index.js";
import type { Provider } from "../providers/index.js";
import type { Wordlist } from "../quais.js";
import type { CrowdsaleAccount } from "./json-crowdsale.js";
import type { KeystoreAccount } from "./json-keystore.js";
import { UTXOHDWallet } from "./utxohdwallet.js";


function stall(duration: number): Promise<void> {
    return new Promise((resolve) => { setTimeout(() => { resolve(); }, duration); });
}

/**
 *  A **Wallet** manages a single private key which is used to sign
 *  transactions, messages and other common payloads.
 *
 *  This class is generally the main entry point for developers
 *  that wish to use a private key directly, as it can create
 *  instances from a large variety of common sources, including
 *  raw private key, [[link-bip-39]] mnemonics and encrypte JSON
 *  wallets.
 */
export class Wallet extends BaseWallet {

    /**
     *  Create a new wallet for the private %%key%%, optionally connected
     *  to %%provider%%.
     */
    constructor(key: string | SigningKey, provider?: null | Provider) {
        if (typeof(key) === "string" && !key.startsWith("0x")) {
            key = "0x" + key;
        }

        let signingKey = (typeof(key) === "string") ? new SigningKey(key): key;
        super(signingKey, provider);
    }

    connect(provider: null | Provider): Wallet {
        return new Wallet(this.signingKey!, provider);
    }

    /**
     *  Resolves to a [JSON Keystore Wallet](json-wallets) encrypted with
     *  %%password%%.
     *
     *  If %%progressCallback%% is specified, it will receive periodic
     *  updates as the encryption process progreses.
     */
    async encrypt(password: Uint8Array | string, progressCallback?: ProgressCallback): Promise<string> {
        const account = { address: this.address, privateKey: this.privateKey };
        return await encryptKeystoreJson(account, password, { progressCallback });
    }

    /**
     *  Returns a [JSON Keystore Wallet](json-wallets) encryped with
     *  %%password%%.
     *
     *  It is preferred to use the [async version](encrypt) instead,
     *  which allows a [[ProgressCallback]] to keep the user informed.
     *
     *  This method will block the event loop (freezing all UI) until
     *  it is complete, which may be a non-trivial duration.
     */
    encryptSync(password: Uint8Array | string): string {
        const account = { address: this.address, privateKey: this.privateKey };
        return encryptKeystoreJsonSync(account, password);
    }

    static #fromAccount(account: null | CrowdsaleAccount | KeystoreAccount): HDNodeWallet | Wallet {
        assertArgument(account, "invalid JSON wallet", "json", "[ REDACTED ]");

        if ("mnemonic" in account && account.mnemonic && account.mnemonic.locale === "en") {
            const mnemonic = Mnemonic.fromEntropy(account.mnemonic.entropy);
            const wallet = HDNodeWallet.fromMnemonic(mnemonic, account.mnemonic.path || ''); // Add a check for undefined path
            if (wallet.address === account.address && wallet.privateKey === account.privateKey) {
                return wallet;
            }
            console.log("WARNING: JSON mismatch address/privateKey != mnemonic; fallback onto private key");
        }

        const wallet = new Wallet(account.privateKey);

        assertArgument(wallet.address === account.address,
            "address/privateKey mismatch", "json", "[ REDACTED ]");

        return wallet;
    }

    /**
     *  Creates (asynchronously) a **Wallet** by decrypting the %%json%%
     *  with %%password%%.
     *
     *  If %%progress%% is provided, it is called periodically during
     *  decryption so that any UI can be updated.
     */
    static async fromEncryptedJson(json: string, password: Uint8Array | string, progress?: ProgressCallback): Promise<HDNodeWallet | Wallet> {
        let account: null | CrowdsaleAccount | KeystoreAccount = null;
        if (isKeystoreJson(json)) {
            account = await decryptKeystoreJson(json, password, progress);

        } else if (isCrowdsaleJson(json)) {
            if (progress) { progress(0); await stall(0); }
            account = decryptCrowdsaleJson(json, password);
            if (progress) { progress(1); await stall(0); }

        }

        return Wallet.#fromAccount(account);
    }

    /**
     *  Creates a **Wallet** by decrypting the %%json%% with %%password%%.
     *
     *  The [[fromEncryptedJson]] method is preferred, as this method
     *  will lock up and freeze the UI during decryption, which may take
     *  some time.
     */
    static fromEncryptedJsonSync(json: string, password: Uint8Array | string): HDNodeWallet | Wallet {
        let account: null | CrowdsaleAccount | KeystoreAccount = null;
        if (isKeystoreJson(json)) {
            account = decryptKeystoreJsonSync(json, password);
        } else if (isCrowdsaleJson(json)) {
            account = decryptCrowdsaleJson(json, password);
        } else {
            assertArgument(false, "invalid JSON wallet", "json", "[ REDACTED ]");
        }

        return Wallet.#fromAccount(account);
    }

    /**
     *  Creates a new random [[HDNodeWallet]] using the available
     *  [cryptographic random source](randomBytes).
     *
     *  If there is no crytographic random source, this will throw.
     */
    static createRandom(path: string, provider?: null | Provider): HDNodeWallet {
        const wallet = HDNodeWallet.createRandom(path);
        if (provider) { return wallet.connect(provider); }
        return wallet;
    }

    /**"m/44'/60'/0'/0/0"
     *  Creates a [[HDNodeWallet]] for %%phrase%%.
     */
    static fromPhrase(phrase: string, path: string, provider?: Provider, wordlist?: Wordlist): HDNodeWallet | UTXOHDWallet {
        const splitPath = path.split('/');
        if (splitPath.length < 3) throw new Error(`Incomplete path for wallet derivation ${path}`);
        let coinTypeStr = splitPath[2];
        coinTypeStr = coinTypeStr.replace("'", "");
        const coinType = parseInt(coinTypeStr);

        let wallet;
        switch (coinType) {
            case 994:
                wallet = HDNodeWallet.fromPhrase(phrase, path, undefined, wordlist);
                if (provider) { return wallet.connect(provider); }
                return wallet;
            case 969:
                wallet = UTXOHDWallet.fromPhrase(phrase, path, undefined, wordlist);
                if (provider) { return wallet.connect(provider); }
                return wallet;
            default:
                throw new Error(`Unsupported cointype ${coinType} for HD wallet derivation`);
        }
    }
}
