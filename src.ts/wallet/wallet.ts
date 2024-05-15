import { SigningKey } from "../crypto/index.js";
import { assertArgument } from "../utils/index.js";

import { BaseWallet } from "./base-wallet.js";
import { QuaiHDWallet } from "./quai-hdwallet.js";
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
import { QiHDWallet } from "./qi-hdwallet.js";


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
 *  raw private key, [BIP-39](https://en.bitcoin.it/wiki/BIP_0039) mnemonics and encrypte JSON
 *  wallets.
 * 
 *  @category Wallet
 */
export class Wallet extends BaseWallet {

    /**
     *  Create a new wallet for the private `key`, optionally connected
     *  to `provider`.
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
     *  `password`.
     *
     *  If `progressCallback` is specified, it will receive periodic
     *  updates as the encryption process progreses.
     * 
     *  @param {Uint8Array | string} password - The password to encrypt the wallet with.
     *  @param {ProgressCallback} [progressCallback] - An optional callback to keep the user informed.
     *  @returns {Promise<string>} The encrypted JSON wallet.
     */
    async encrypt(password: Uint8Array | string, progressCallback?: ProgressCallback): Promise<string> {
        const account = { address: this.address, privateKey: this.privateKey };
        return await encryptKeystoreJson(account, password, { progressCallback });
    }

    /**
     *  Returns a [JSON Keystore Wallet](json-wallets) encryped with
     *  `password`.
     *
     *  It is preferred to use the [async version](encrypt) instead,
     *  which allows a {@link ProgressCallback | **ProgressCallback**} to keep the user informed.
     *
     *  This method will block the event loop (freezing all UI) until
     *  it is complete, which may be a non-trivial duration.
     * 
     *  @param {Uint8Array | string} password - The password to encrypt the wallet with.
     *  @returns {string} The encrypted JSON wallet.
     */
    encryptSync(password: Uint8Array | string): string {
        const account = { address: this.address, privateKey: this.privateKey };
        return encryptKeystoreJsonSync(account, password);
    }

    static #fromAccount(account: null | CrowdsaleAccount | KeystoreAccount): QuaiHDWallet | Wallet {
        assertArgument(account, "invalid JSON wallet", "json", "[ REDACTED ]");

        if ("mnemonic" in account && account.mnemonic && account.mnemonic.locale === "en") {
            const mnemonic = Mnemonic.fromEntropy(account.mnemonic.entropy);
            const wallet = QuaiHDWallet.fromMnemonic(mnemonic, account.mnemonic.path || ''); // Add a check for undefined path
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
     *  Creates (asynchronously) a **Wallet** by decrypting the `json`
     *  with `password`.
     *
     *  If `progress` is provided, it is called periodically during
     *  decryption so that any UI can be updated.
     * 
     *  @param {string} json - The JSON data to decrypt.
     *  @param {Uint8Array | string} password - The password to decrypt the JSON data.
     *  @param {ProgressCallback} [progress] - An optional callback to keep the user informed.
     *  @returns {Promise<QuaiHDWallet | Wallet>} The decrypted wallet.
     */
    static async fromEncryptedJson(json: string, password: Uint8Array | string, progress?: ProgressCallback): Promise<QuaiHDWallet | Wallet> {
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
     *  Creates a **Wallet** by decrypting the `json` with `password`.
     *
     *  The {@link Wallet.fromEncryptedJson | **fromEncryptedJson**} method is preferred, as this method
     *  will lock up and freeze the UI during decryption, which may take
     *  some time.
     * 
     *  @param {string} json - The JSON data to decrypt.
     *  @param {Uint8Array | string} password - The password to decrypt the JSON data.
     *  @returns {QuaiHDWallet | Wallet} The decrypted wallet.
     */
    static fromEncryptedJsonSync(json: string, password: Uint8Array | string): QuaiHDWallet | Wallet {
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
     *  Creates a new random {@link QuaiHDWallet | **QuaiHDWallet**} using the available
     *  [cryptographic random source](randomBytes).
     *
     *  If there is no crytographic random source, this will throw.
     * 
     *  @param {string} path - The derivation path for the wallet.
     *  @param {Provider} [provider] - An optional provider to connect the wallet to.
     *  @returns {QuaiHDWallet} The new wallet.
     */
    static createRandom(path: string, provider?: null | Provider): QuaiHDWallet {
        const wallet = QuaiHDWallet.createRandom(path);
        if (provider) { return wallet.connect(provider); }
        return wallet;
    }

    /**"m/44'/60'/0'/0/0"
     *  Creates a {@link QuaiHDWallet | **QuaiHDWallet**} for `phrase`.
     * 
     *  @param {string} phrase - The mnemonic phrase to create the wallet with.
     *  @param {string} path - The derivation path for the wallet.
     *  @param {Provider} [provider] - An optional provider to connect the wallet to.
     *  @param {Wordlist} [wordlist] - An optional wordlist to use for the mnemonic phrase.
     *  @returns {QuaiHDWallet} The new wallet.
     */
    static fromPhrase(phrase: string, path: string, provider?: Provider, wordlist?: Wordlist): QuaiHDWallet | QiHDWallet {
        const splitPath = path.split('/');
        if (splitPath.length < 3) throw new Error(`Incomplete path for wallet derivation ${path}`);
        let coinTypeStr = splitPath[2];
        coinTypeStr = coinTypeStr.replace("'", "");
        const coinType = parseInt(coinTypeStr);

        let wallet;
        switch (coinType) {
            case 994:
                wallet = QuaiHDWallet.fromPhrase(phrase, path, undefined, wordlist);
                if (provider) { return wallet.connect(provider); }
                return wallet;
            case 969:
                wallet = QiHDWallet.fromPhrase(phrase, path, undefined, wordlist);
                if (provider) { return wallet.connect(provider); }
                return wallet;
            default:
                throw new Error(`Unsupported cointype ${coinType} for HD wallet derivation`);
        }
    }
}
