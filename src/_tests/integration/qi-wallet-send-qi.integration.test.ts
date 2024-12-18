import assert from 'assert';
import { loadTests } from '../utils.js';
import { Mnemonic, QiHDWallet, Zone, QiTransactionResponse, JsonRpcProvider } from '../../index.js';

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

import dotenv from 'dotenv';
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` });
dotenv.config({ path: `.env`, override: false });

interface QiRoundtripTestCase {
    alice: {
        mnemonic: string;
        sendAmount: bigint;
    };
    bob: {
        mnemonic: string;
        sendAmount: bigint;
    };
}

describe('QiHDWallet Roundtrip Transaction', async function () {
    const tests = loadTests<QiRoundtripTestCase>('qi-wallet-roundtrip');
    let aliceWallet: QiHDWallet;
    let bobWallet: QiHDWallet;
    let alicePaymentCode: string;
    let bobPaymentCode: string;

    const options = { usePathing: true };
    const provider = new JsonRpcProvider(process.env.RPC_URL, undefined, options);

    for (const test of tests) {
        this.timeout(1200000);
        const aliceMnemonic = Mnemonic.fromPhrase(test.alice.mnemonic);
        aliceWallet = QiHDWallet.fromMnemonic(aliceMnemonic);
        aliceWallet.connect(provider);

        const bobMnemonic = Mnemonic.fromPhrase(test.bob.mnemonic);
        bobWallet = QiHDWallet.fromMnemonic(bobMnemonic);
        bobWallet.connect(provider);

        alicePaymentCode = aliceWallet.getPaymentCode(0);
        bobPaymentCode = bobWallet.getPaymentCode(0);
        console.log(`---> alicePaymentCode: ${alicePaymentCode}`);
        console.log(`---> bobPaymentCode: ${bobPaymentCode}`);
        aliceWallet.openChannel(bobPaymentCode);
        bobWallet.openChannel(alicePaymentCode);
        try {
            console.log('scanning alice wallet');
            await aliceWallet.scan(Zone.Cyprus1);
        } catch (error) {
            console.log('error scanning alice wallet', error);
            // exit the test
        }
        try {
            console.log('scanning bob wallet');
            await bobWallet.scan(Zone.Cyprus1);
        } catch (error) {
            console.log('error scanning bob wallet', error);
            // exit the test
        }
        console.log('getting alice initial balance');
        const aliceInitialBalance = await aliceWallet.getBalanceForZone(Zone.Cyprus1);
        console.log('getting bob initial balance');
        const bobInitialBalance = await bobWallet.getBalanceForZone(Zone.Cyprus1);

        it('validates initial balances', async function () {
            // Alice initial balance should be greater than zero
            assert.ok(aliceInitialBalance > BigInt(0), 'Alice initial balance should be greater than zero');
            // Bob initial balance should be zero
            assert.equal(bobInitialBalance.toString(), '0', 'Bob initial balance should be zero');
        });

        it('validates first transaction is sent and confirmed', async function () {
            const tx = (await aliceWallet.sendTransaction(
                bobPaymentCode,
                test.alice.sendAmount,
                Zone.Cyprus1,
                Zone.Cyprus1,
            )) as QiTransactionResponse;

            await assert.doesNotReject(async () => {
                await tx.wait();
            });
            console.log(`... succesfully sent ${test.alice.sendAmount} to Bob`);
        });

        let aliceFee: bigint;
        it('validates Alice and Bob wallet balance after first transaction', async function () {
            await aliceWallet.sync(Zone.Cyprus1);
            await bobWallet.sync(Zone.Cyprus1);

            const bobUpdatedBalance = await bobWallet.getBalanceForZone(Zone.Cyprus1);
            assert.equal(
                bobUpdatedBalance.toString(),
                test.alice.sendAmount.toString(),
                `Expected Bob's balance to be ${test.alice.sendAmount.toString()} but got ${bobUpdatedBalance.toString()}`,
            );

            // Alice's balance should be lower than the initial balance minus the amount sent (because of the tx fee)
            const aliceUpdatedBalance = await aliceWallet.getBalanceForZone(Zone.Cyprus1);
            const aliceBalanceWithoutFee = aliceInitialBalance - test.alice.sendAmount;
            aliceFee = aliceBalanceWithoutFee - aliceUpdatedBalance;
            assert.ok(
                aliceUpdatedBalance < aliceBalanceWithoutFee,
                `Expected Alice's balance to be less than ${aliceBalanceWithoutFee.toString()} but got ${aliceUpdatedBalance.toString()}`,
            );
        });

        it('validates second transaction is sent and confirmed', async function () {
            const tx = (await bobWallet.sendTransaction(
                alicePaymentCode,
                test.bob.sendAmount,
                Zone.Cyprus1,
                Zone.Cyprus1,
            )) as QiTransactionResponse;

            await assert.doesNotReject(async () => {
                await tx.wait();
            });
            console.log(`... succesfully sent ${test.bob.sendAmount} to Alice`);
        });

        it('validates Alice and Bob wallet balance after second transaction', async function () {
            await aliceWallet.sync(Zone.Cyprus1);
            await bobWallet.sync(Zone.Cyprus1);

            const aliceUpdatedBalance = await aliceWallet.getBalanceForZone(Zone.Cyprus1);
            const bobUpdatedBalance = await bobWallet.getBalanceForZone(Zone.Cyprus1);

            const bobBalanceWithoutFee =
                bobInitialBalance + BigInt(test.alice.sendAmount) - BigInt(test.bob.sendAmount);
            const aliceExpectedBalance =
                aliceInitialBalance - BigInt(test.alice.sendAmount) + BigInt(test.bob.sendAmount) - aliceFee;
            assert.equal(
                aliceUpdatedBalance.toString(),
                aliceExpectedBalance.toString(),
                `Expected Alice's balance to be ${aliceExpectedBalance.toString()} but got ${aliceUpdatedBalance.toString()}`,
            );

            assert.ok(
                bobUpdatedBalance < bobBalanceWithoutFee,
                `Expected Bob's balance to be less than ${bobBalanceWithoutFee.toString()} but got ${bobUpdatedBalance.toString()}`,
            );
        });
    }
});
