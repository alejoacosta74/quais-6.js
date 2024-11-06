import { AbstractHDWallet, NeuteredAddressInfo, _guard } from './hdwallet.js';
import { HDNodeWallet } from './hdnodewallet.js';
import { QuaiTransactionRequest, Provider, TransactionResponse } from '../providers/index.js';
import { isQuaiAddress, resolveAddress } from '../address/index.js';
import { AllowedCoinType, Zone } from '../constants/index.js';
import { SerializedHDWallet, HARDENED_OFFSET } from './hdwallet.js';
import { Mnemonic } from './mnemonic.js';
import { TypedDataDomain, TypedDataField } from '../hash/index.js';
import { getZoneForAddress } from '../utils/index.js';

export interface SerializedQuaiHDWallet extends SerializedHDWallet {
    addresses: Array<NeuteredAddressInfo>;
}

/**
 * The Quai HD wallet is a BIP44-compliant hierarchical deterministic wallet used for managing a set of addresses in the
 * Quai ledger. This is the easiest way to manage the interaction of managing accounts and addresses on the Quai
 * network, however, if your use case requires a single address Quai address, you can use the {@link Wallet} class.
 *
 * The Quai HD wallet supports:
 *
 * - Adding accounts to the wallet heierchy
 * - Generating addresses for a specific account in any {@link Zone}
 * - Signing and sending transactions for any address in the wallet
 * - Signing and verifying EIP1193 typed data for any address in the wallet.
 * - Serializing the wallet to JSON and deserializing it back to a wallet instance.
 *
 * @category Wallet
 * @example
 *
 * ```ts
 * import { QuaiHDWallet, Zone } from 'quais';
 *
 * const wallet = new QuaiHDWallet();
 * const cyrpus1Address = await wallet.getNextAddress(0, Zone.Cyrpus1); // get the first address in the Cyrpus1 zone
 * await wallet.sendTransaction({ from: address, to: '0x...', value: 100 }); // send a transaction
 * const serializedWallet = wallet.serialize(); // serialize current (account/address) state of the wallet
 * .
 * .
 * .
 * const deserializedWallet = QuaiHDWallet.deserialize(serializedWallet); // create a new wallet instance from the serialized data
 * ```
 */
export class QuaiHDWallet extends AbstractHDWallet<NeuteredAddressInfo> {
    /**
     * The version of the wallet.
     *
     * @type {number}
     * @static
     */
    protected static _version: number = 1;

    /**
     * The coin type for the wallet.
     *
     * @type {AllowedCoinType}
     * @static
     */
    protected static _coinType: AllowedCoinType = 994;

    /**
     * Create a QuaiHDWallet instance.
     *
     * @param {HDNodeWallet} root - The root HD node wallet.
     * @param {Provider} [provider] - The provider.
     */
    constructor(guard: any, root: HDNodeWallet, provider?: Provider) {
        super(guard, root, provider);
    }

    /**
     * Sign a transaction.
     *
     * @param {QuaiTransactionRequest} tx - The transaction request.
     * @returns {Promise<string>} A promise that resolves to the signed transaction.
     */
    public async signTransaction(tx: QuaiTransactionRequest): Promise<string> {
        const from = await resolveAddress(tx.from);
        const fromNode = this._getHDNodeForAddress(from);
        const signedTx = await fromNode.signTransaction(tx);
        return signedTx;
    }

    /**
     * Send a transaction.
     *
     * @param {QuaiTransactionRequest} tx - The transaction request.
     * @returns {Promise<TransactionResponse>} A promise that resolves to the transaction response.
     * @throws {Error} If the provider is not set.
     */
    public async sendTransaction(tx: QuaiTransactionRequest): Promise<TransactionResponse> {
        if (!this.provider) {
            throw new Error('Provider is not set');
        }
        const from = await resolveAddress(tx.from);
        const fromNode = this._getHDNodeForAddress(from);
        const fromNodeConnected = fromNode.connect(this.provider);
        return await fromNodeConnected.sendTransaction(tx);
    }

    /**
     * Sign a message.
     *
     * @param {string} address - The address.
     * @param {string | Uint8Array} message - The message to sign.
     * @returns {Promise<string>} A promise that resolves to the signed message.
     */
    public async signMessage(address: string, message: string | Uint8Array): Promise<string> {
        const addrNode = this._getHDNodeForAddress(address);
        return await addrNode.signMessage(message);
    }

    /**
     * Serializes the QuaiHDWallet state into a format suitable for storage or transmission.
     *
     * This method extends the serialization from the parent class (AbstractHDWallet) and includes additional
     * QuaiHDWallet-specific data, such as the addresses.
     *
     * @example Const wallet = new QuaiHDWallet(); const serializedData = wallet.serialize(); // serializedData can now
     * be stored or transmitted
     *
     * @returns {SerializedQuaiHDWallet} An object representing the serialized state of the QuaiHDWallet, including
     *   addresses and other inherited properties from the parent wallet.
     */
    public serialize(): SerializedQuaiHDWallet {
        const hdwalletSerialized = super.serialize();

        return {
            ...hdwalletSerialized,
            addresses: Array.from(this._addresses.values()),
        };
    }

    /**
     * Deserializes the given serialized HD wallet data into an instance of QuaiHDWallet.
     *
     * @async
     * @param {SerializedHDWallet} serialized - The serialized wallet data to be deserialized.
     * @returns {Promise<QuaiHDWallet>} A promise that resolves to an instance of QuaiHDWallet.
     * @throws {Error} If validation of the serialized wallet data fails or if deserialization fails.
     * @public
     * @static
     */
    public static async deserialize(serialized: SerializedQuaiHDWallet): Promise<QuaiHDWallet> {
        super.validateSerializedWallet(serialized);
        // create the wallet instance
        const mnemonic = Mnemonic.fromPhrase(serialized.phrase);
        const path = (this as any).parentPath(serialized.coinType);
        const root = HDNodeWallet.fromMnemonic(mnemonic, path);
        const wallet = new this(_guard, root);

        // import the addresses
        wallet.importSerializedAddresses(serialized.addresses);

        return wallet;
    }

    /**
     * Signs typed data using the private key associated with the given address.
     *
     * @param {string} address - The address for which the typed data is to be signed.
     * @param {TypedDataDomain} domain - The domain information of the typed data, defining the scope of the signature.
     * @param {Record<string, TypedDataField[]>} types - The types of the data to be signed, mapping each data type name
     *   to its fields.
     * @param {Record<string, unknown>} value - The actual data to be signed.
     * @returns {Promise<string>} A promise that resolves to the signed data in string format.
     * @throws {Error} If the address does not correspond to a valid HD node or if signing fails.
     */
    public async signTypedData(
        address: string,
        domain: TypedDataDomain,
        types: Record<string, Array<TypedDataField>>,
        value: Record<string, unknown>,
    ): Promise<string> {
        const addrNode = this._getHDNodeForAddress(address);
        return addrNode.signTypedData(domain, types, value);
    }

    /**
     * Adds an address to the wallet.
     *
     * @param {number} account - The account number.
     * @param {number} addressIndex - The address index.
     * @returns {NeuteredAddressInfo} The added address info.
     */
    public addAddress(account: number, addressIndex: number): NeuteredAddressInfo {
        return this._addAddress(account, addressIndex) as NeuteredAddressInfo;
    }

    /**
     * Helper method to add an address to the wallet address map.
     *
     * @param {Map<string, NeuteredAddressInfo>} addressMap - The address map.
     * @param {number} account - The account number.
     * @param {number} addressIndex - The address index.
     * @returns {NeuteredAddressInfo} The added address info.
     * @throws {Error} If the address for the index already exists.
     */
    protected _addAddress(account: number, addressIndex: number): NeuteredAddressInfo {
        // check if address already exists for the index
        this._addresses.forEach((addressInfo) => {
            if (addressInfo.index === addressIndex) {
                throw new Error(`Address for index ${addressIndex} already exists`);
            }
        });

        // derive the address node and validate the zone
        const changeIndex = 0;
        const addressNode = this._root
            .deriveChild(account + HARDENED_OFFSET)
            .deriveChild(changeIndex)
            .deriveChild(addressIndex);
        const zone = getZoneForAddress(addressNode.address);
        if (!zone) {
            throw new Error(`Failed to derive a valid address zone for the index ${addressIndex}`);
        }

        if (!isQuaiAddress(addressNode.address)) {
            throw new Error(`Address ${addressNode.address} is not a valid Quai address`);
        }

        return this.createAndStoreAddressInfo(addressNode, account, zone);
    }

    /**
     * Imports addresses from a serialized wallet into the addresses map. Before adding the addresses, a validation is
     * performed to ensure the address, public key, and zone match the expected values.
     *
     * @param {Map<string, NeuteredAddressInfo>} addressMap - The map where the addresses will be imported.
     * @param {NeuteredAddressInfo[]} addresses - The array of addresses to be imported, each containing account, index,
     *   address, pubKey, and zone information.
     * @throws {Error} If there is a mismatch between the expected and actual address, public key, or zone.
     * @protected
     */
    protected importSerializedAddresses(addresses: NeuteredAddressInfo[]): void {
        for (const addressInfo of addresses) {
            const newAddressInfo = this._addAddress(addressInfo.account, addressInfo.index);
            // validate the address info
            if (addressInfo.address !== newAddressInfo.address) {
                throw new Error(`Address mismatch: ${addressInfo.address} != ${newAddressInfo.address}`);
            }
            if (addressInfo.pubKey !== newAddressInfo.pubKey) {
                throw new Error(`Public key mismatch: ${addressInfo.pubKey} != ${newAddressInfo.pubKey}`);
            }
            if (addressInfo.zone !== newAddressInfo.zone) {
                throw new Error(`Zone mismatch: ${addressInfo.zone} != ${newAddressInfo.zone}`);
            }
        }
    }

    /**
     * Promise that resolves to the next address for the specified account and zone.
     *
     * @param {number} account - The index of the account for which to retrieve the next address.
     * @param {Zone} zone - The zone in which to retrieve the next address.
     * @returns {Promise<T>} The next neutered address information.
     */
    public async getNextAddress(account: number, zone: Zone): Promise<NeuteredAddressInfo> {
        return Promise.resolve(this._getNextAddress(account, zone));
    }

    /**
     * Synchronously retrieves the next address for the specified account and zone.
     *
     * @param {number} account - The index of the account for which to retrieve the next address.
     * @param {Zone} zone - The zone in which to retrieve the next address.
     * @returns {T} The next neutered address information.
     */
    public getNextAddressSync(account: number, zone: Zone): NeuteredAddressInfo {
        return this._getNextAddress(account, zone);
    }

    /**
     * Derives and returns the next address information for the specified account and zone.
     *
     * @param {number} accountIndex - The index of the account for which the address is being generated.
     * @param {Zone} zone - The zone in which the address is to be used.
     * @param {Map<string, NeuteredAddressInfo>} addressMap - A map storing the neutered address information.
     * @returns {T} The derived neutered address information.
     * @throws {Error} If the zone is invalid.
     */
    protected _getNextAddress(accountIndex: number, zone: Zone): NeuteredAddressInfo {
        this.validateZone(zone);
        const lastIndex = this.getLastAddressIndex(this._addresses, zone, accountIndex);
        const addressNode = this.deriveNextAddressNode(accountIndex, lastIndex + 1, zone, false);
        return this.createAndStoreAddressInfo(addressNode, accountIndex, zone);
    }

    /**
     * Creates and stores address information in the address map for a specified account, zone, and change type.
     *
     * This method constructs a NeuteredAddressInfo object using the provided HDNodeWallet and other parameters, then
     * stores this information in the provided address map.
     *
     * @param {HDNodeWallet} addressNode - The HDNodeWallet object containing the address and public key information.
     * @param {number} account - The account number to associate with the address.
     * @param {Zone} zone - The specific zone to associate with the address.
     * @param {Map<string, NeuteredAddressInfo>} addressMap - The map to store the created NeuteredAddressInfo, with the
     *   address as the key.
     * @returns {NeuteredAddressInfo} - The created NeuteredAddressInfo object.
     * @protected
     */
    protected createAndStoreAddressInfo(addressNode: HDNodeWallet, account: number, zone: Zone): NeuteredAddressInfo {
        const neuteredAddressInfo: NeuteredAddressInfo = {
            pubKey: addressNode.publicKey,
            address: addressNode.address,
            account,
            index: addressNode.index,
            zone,
        };

        this._addresses.set(neuteredAddressInfo.address, neuteredAddressInfo);

        return neuteredAddressInfo;
    }

    /**
     * Gets the address info for a given address.
     *
     * @param {string} address - The address.
     * @returns {T | null} The address info or null if not found.
     */
    public getAddressInfo(address: string): NeuteredAddressInfo | null {
        const addressInfo = this._addresses.get(address);
        if (!addressInfo) {
            return null;
        }
        return addressInfo;
    }
}
