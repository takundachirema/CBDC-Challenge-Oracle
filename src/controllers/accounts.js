import xrpl from 'xrpl';
import Account from '../models/accounts.js';
import Transaction from '../models/transactions.js';

/**
 * Sends a message to the enclave to create an account
 * @param {*} res
 */
export async function createEscrowAccount(res) {
	res.status(200).json({ success: true });
}

export async function getEscrowAccounts(res) {
	res.status(200).json({ success: true });
}

export async function getTransactions(res, parameters) {
	const account = parameters.account;
	const transactions = await Transaction.find({ account: account });
	res.status(200).json({ success: true, result: transactions });
}

/**
 * Gets transactions from escrow account
 */
export async function checkEscrowAccounts(res) {
	const account = await Account.findOne({ address: process.env.ESCROW_ACCOUNT });

	const client = new xrpl.Client(process.env.RIPPLE_SERVER);

	try {
		await client.connect();

		let requestParams = {
			command: 'account_tx',
			account: process.env.ESCROW_ACCOUNT,
			ledger_index_min: -1,
			ledger_index_max: -1,
			binary: false,
			// limit: 2,
			ledger_index: 'validated',
		};

		// Put in the marker in case we receive paginated results
		if (account.marker) {
			// requestParams.marker = account.marker;
		}

		const response = await client.request(requestParams);
		client.disconnect();

		const result = response.result;

		if (result.marker) {
			account.marker = result.marker;
			await account.save();
		}

		processTransactions(account, result);

		res.status(200).json({ success: true, data: response.result });
	} catch (err) {
		res.status(200).json({ success: false, error: err.message });
	}
}

async function processTransactions(account, result) {
	// console.log(result.transactions[0]);

	const transactions = [];

	for (const transaction of result.transactions) {
		transactions.push({ hash: transaction.tx.hash, account: account.address });
	}

	try {
		await Transaction.insertMany(transactions, {
			ordered: false,
		});
	} catch (err) {
		switch (err.code) {
			case 11000:
				console.log('Duplicate key error during bulk insert ');
				break;
			default:
				throw 'Unknown error during bulk insert';
		}
	}
}
