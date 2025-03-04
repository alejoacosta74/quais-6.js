/**
 *  About provider formatting?
 *
 *  @_section: api/providers/formatting:Formatting  [provider-formatting]
 */

import type { Signature } from "../crypto/index.js";
import type { AccessList } from "../transaction/index.js";
import type { UTXOTransactionInput, UTXOTransactionOutput } from "../transaction/utxo.js";

//////////////////////
// Block

/**
 *  a **BlockParams** encodes the minimal required properties for a
 *  formatted block.
 */
export interface BlockParams {
    /**
     *  The block hash.
     */
    hash?: null | string;

    /**
     *  The block number.
     */
    number: Array<number> | number;

    /**
     *  The timestamp for this block, which is the number of seconds
     *  since epoch that this block was included.
     */
    timestamp: number;

    /**
     *  The hash of the previous block in the blockchain. The genesis block
     *  has the parentHash of the [[ZeroHash]].
     */
    parentHash: Array<string> | string;

    /**
     *  A random sequence provided during the mining process for
     *  proof-of-work networks.
     */
    nonce: string;

    /**
     *  For proof-of-work networks, the difficulty target is used to
     *  adjust the difficulty in mining to ensure a expected block rate.
     */
    difficulty: bigint;

    /**
     *  The maximum amount of gas a block can consume.
     */
    gasLimit: bigint;

    /**
     *  The amount of gas a block consumed.
     */
    gasUsed: bigint;

    /**
     *  The miner (or author) of a block.
     */
    miner: string;

    /**
     *  Additional data the miner choose to include.
     */
    extraData: string;

    /**
     *  The protocol-defined base fee per gas in an [[link-eip-1559]]
     *  block.
     */
    baseFeePerGas: null | bigint;

    manifestHash: Array<string>;

    location: bigint;

    parentDeltaS: Array<bigint>;

    parentEntropy: Array<bigint>;

    order: number;

    subManifest: Array<string> | null;

    totalEntropy: bigint;

    mixHash: string;

    receiptsRoot: string;

    sha3Uncles: string;

    size: bigint;

    evmRoot: string;

    utxoRoot: string;

    uncles: Array<string> | null;

    /**
     *  The list of transactions in the block.
     */
    transactions: ReadonlyArray<string | TransactionResponseParams>;

    transactionsRoot: string;

    extRollupRoot: string;

    extTransactions: ReadonlyArray<string | TransactionResponseParams>;

    extTransactionsRoot: string;
};


//////////////////////
// Log

/**
 *  a **LogParams** encodes the minimal required properties for a
 *  formatted log.
 */
export interface LogParams {
    /**
     *  The transaction hash for the transaxction the log occurred in.
     */
    transactionHash: string;

    /**
     *  The block hash of the block that included the transaction for this
     *  log.
     */
    blockHash: string;

    /**
     *  The block number of the block that included the transaction for this
     *  log.
     */
    blockNumber: number;

    /**
     *  Whether this log was removed due to the transaction it was included
     *  in being removed dur to an orphaned block.
     */
    removed: boolean;

    /**
     *  The address of the contract that emitted this log.
     */
    address: string;

    /**
     *  The data emitted with this log.
     */
    data: string;

    /**
     *  The topics emitted with this log.
     */
    topics: ReadonlyArray<string>;

    /**
     *  The index of this log.
     */
    index: number;

    /**
     *  The transaction index of this log.
     */
    transactionIndex: number;
}


//////////////////////
//Etx within a transaction receipt for and internal to external transaction

export interface EtxParams {
    type: number;
    nonce: number;
    gasPrice: null | bigint;
    maxPriorityFeePerGas: bigint;
    maxFeePerGas: bigint;
    gas: bigint;
    value: bigint;
    input: string;
    to: null | string;
    accessList: null | AccessList;
    chainId: null | bigint;
    from: null | string;
    hash: string;
}
// Transaction Receipt

/**
 *  a **TransactionReceiptParams** encodes the minimal required properties
 *  for a formatted transaction receipt.
 */
export interface TransactionReceiptParams {
    /**
     *  The target of the transaction. If null, the transaction was trying
     *  to deploy a transaction with the ``data`` as the initi=code.
     */
    to: null | string;

    /**
     *  The sender of the transaction.
     */
    from: string;

    /**
     *  If the transaction was directly deploying a contract, the [[to]]
     *  will be null, the ``data`` will be initcode and if successful, this
     *  will be the address of the contract deployed.
     */
    contractAddress: null | string;

    /**
     *  The transaction hash.
     */
    hash: string;

    /**
     *  The transaction index.
     */
    index: number;

    /**
     *  The block hash of the block that included this transaction.
     */
    blockHash: string;

    /**
     *  The block number of the block that included this transaction.
     */
    blockNumber: number;

    /**
     *  The bloom filter for the logs emitted during execution of this
     *  transaction.
     */
    logsBloom: string;

    /**
     *  The logs emitted during the execution of this transaction.
     */
    logs: ReadonlyArray<LogParams>;

    /**
     *  The amount of gas consumed executing this transaciton.
     */
    gasUsed: bigint;

    /**
     *  The total amount of gas consumed during the entire block up to
     *  and including this transaction.
     */
    cumulativeGasUsed: bigint;

    /**
     *  The actual gas price per gas charged for this transaction.
     */
    gasPrice?: null | bigint;

    /**
     *  The actual gas price per gas charged for this transaction.
     */
    effectiveGasPrice?: null | bigint;

    /**
     *  The [[link-eip-2718]] envelope type.
     */
    type: number;
    //byzantium: boolean;

    /**
     *  The status of the transaction execution. If ``1`` then the
     *  the transaction returned success, if ``0`` then the transaction
     *  was reverted. For pre-byzantium blocks, this is usually null, but
     *  some nodes may have backfilled this data.
     */
    status: null | number;

    etxs: ReadonlyArray<string>;

}




//////////////////////
// Transaction Response

/**
 *  a **TransactionResponseParams** encodes the minimal required properties
 *  for a formatted transaction response.
 */
export interface TransactionResponseParams {
    /**
     *  The block number of the block that included this transaction.
     */
    blockNumber: null | number;

    /**
     *  The block hash of the block that included this transaction.
     */
    blockHash: null | string;

    /**
     *  The transaction hash.
     */
    hash: string;

    /**
     *  The transaction index.
     */
    index: bigint;

 
    type: number;

    /**
     *  The target of the transaction. If ``null``, the ``data`` is initcode
     *  and this transaction is a deployment transaction.
     */
    to: null | string;

    /**
     *  The sender of the transaction.
     */
    from: string;

    /**
     *  The nonce of the transaction, used for replay protection.
     */
    nonce: number;

    /**
     *  The maximum amount of gas this transaction is authorized to consume.
     */
    gasLimit: bigint;

    /**
     *  For [[link-eip-1559]] transactions, this is the maximum priority
     *  fee to allow a producer to claim.
     */
    maxPriorityFeePerGas: null | bigint;

    /**
     *  For [[link-eip-1559]] transactions, this is the maximum fee that
     *  will be paid.
     */
    maxFeePerGas: null | bigint;

    /**
     *  The transaction data.
     */
    data: string;

    /**
     *  The transaction value (in wei).
     */
    value: bigint;

    /**
     *  The chain ID this transaction is valid on.
     */
    chainId: bigint;

    /**
     *  The signature of the transaction.
     */
    signature: Signature;

    /**
     *  The transaction access list.
     */
    accessList: null | AccessList;

    outputsUTXO ?: UTXOTransactionOutput[];

    inputsUTXO ?: UTXOTransactionInput[];
};


