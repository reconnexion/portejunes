const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { mnemonicGenerate, cryptoWaitReady } = require('@polkadot/util-crypto');
const CONFIG = require('../config/config');

// Thin wrapper around @polkadot/api, validated against a real Duniter v2 node (see the plan's
// "Step-1 spike results" for how these choices were confirmed):
// - Duniter v2 has no GVA/GraphQL transfer API: transfers are plain Substrate extrinsics.
// - Wallet keys are ed25519 (matching g1-wallet-bot's real code), not Substrate's default sr25519.
// - `ss58Format` must be hardcoded (4450 for Ğ1/Ğ1-Test) -- the chain doesn't publish it over RPC,
//   and @polkadot/api's own auto-detection only fires for genesis hashes it already knows about.

let apiPromise;

async function getApi() {
  if (apiPromise) return apiPromise;

  apiPromise = (async () => {
    await cryptoWaitReady();
    let lastError;
    for (const endpoint of CONFIG.DUNITER_RPC_ENDPOINTS) {
      try {
        const provider = new WsProvider(endpoint, false);
        // WsProvider retries forever by default -- without a timeout, an unreachable endpoint
        // hangs `connect()` indefinitely instead of failing over to the next one.
        await Promise.race([
          provider.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('connection timed out')), 8000))
        ]);
        return await ApiPromise.create({ provider, throwOnConnect: true });
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(`Could not connect to any Duniter RPC endpoint: ${lastError?.message}`);
  })();

  // Don't cache a rejected connection attempt -- let the next call retry.
  apiPromise.catch(() => {
    apiPromise = undefined;
  });

  return apiPromise;
}

function getKeyring() {
  return new Keyring({ type: 'ed25519', ss58Format: CONFIG.DUNITER_SS58_FORMAT });
}

/** Generates a brand-new ed25519 keypair. Returns the mnemonic (to store as the wallet secret)
 *  and the derived Ğ1 address. */
async function createKeypair() {
  await cryptoWaitReady();
  const keyring = getKeyring();
  const seed = mnemonicGenerate();
  const pair = keyring.addFromMnemonic(seed);
  return { seed, address: pair.address };
}

/** Free balance in centimes (integer, 100 = 1 Ğ1). */
async function getBalance(address) {
  const api = await getApi();
  const info = await api.query.system.account(address);
  return info.data.free.toNumber();
}

async function getExistentialDeposit() {
  const api = await getApi();
  return api.consts.balances.existentialDeposit.toNumber();
}

/** Signs and submits a transferKeepAlive from the wallet identified by `seed` to `toAddress`,
 *  optionally with a `comment`. Resolves once the extrinsic is included in a block; throws on a
 *  dispatch error (including the recipient not meeting the existential deposit, or the sender
 *  being left below it).
 *
 *  A comment can't be attached to a plain `transferKeepAlive` -- there's no memo field on a
 *  Substrate balance transfer. The chain indexer (duniter-squid's `data_handler.ts`) only links
 *  a comment to a transfer when a `system.remarkWithEvent` call sits in the *same extrinsic* as
 *  the `balances.transfer` event (it walks `event.extrinsic.events` looking for one) -- so a
 *  comment has to be submitted as a `utility.batchAll([transferKeepAlive, remarkWithEvent])`,
 *  not as a separate call. `remark` (no event) wouldn't work either: with no event, the indexer
 *  has nothing to pick up at all. */
async function transfer(seed, toAddress, amountCentimes, comment) {
  const api = await getApi();
  const pair = getKeyring().addFromMnemonic(seed);

  const transferCall = api.tx.balances.transferKeepAlive(toAddress, amountCentimes);
  const call = comment ? api.tx.utility.batchAll([transferCall, api.tx.system.remarkWithEvent(comment)]) : transferCall;

  return new Promise((resolve, reject) => {
    call
      .signAndSend(pair, ({ status, dispatchError, txHash }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
        } else if (status.isInBlock) {
          resolve({ txHash: txHash.toString(), blockHash: status.asInBlock.toString() });
        }
      })
      .catch(reject);
  });
}

/** Best-effort transfer history from the chain indexer (see the plan's "Open risk" section --
 *  no fallback if the indexer is down). Returns [] on failure rather than throwing, since this
 *  backs a UI list, not a balance-critical path. Query shape verified against a live
 *  indexer.duniter.org response: `comment` is a `TxComment` object (needs a `{ remark }`
 *  subfield selection, not a bare scalar). */
async function getHistory(address) {
  if (!CONFIG.DUNITER_INDEXER_URL) return [];
  try {
    const response = await fetch(CONFIG.DUNITER_INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($address: String!) {
          transfers(first: 50, orderBy: TIMESTAMP_DESC, filter: { or: [{ fromId: { equalTo: $address } }, { toId: { equalTo: $address } }] }) {
            nodes {
              fromId toId amount timestamp
              comment { remark }
              from { linkedIdentity { name } }
              to { linkedIdentity { name } }
            }
          }
        }`,
        variables: { address }
      })
    });
    const { data, errors } = await response.json();
    if (errors) throw new Error(errors.map(e => e.message).join(', '));
    return data.transfers.nodes.map(n => ({
      fromId: n.fromId,
      toId: n.toId,
      amount: n.amount,
      timestamp: n.timestamp,
      comment: n.comment?.remark,
      fromIdentity: n.from?.linkedIdentity?.name ?? null,
      toIdentity: n.to?.linkedIdentity?.name ?? null
    }));
  } catch (e) {
    return [];
  }
}

module.exports = { createKeypair, getBalance, getExistentialDeposit, transfer, getHistory };
