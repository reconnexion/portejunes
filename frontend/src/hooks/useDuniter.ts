import { DUNITER_RPC_ENDPOINTS, DUNITER_INDEXER_URL, DUNITER_SS58_FORMAT, DUNITER_NETWORK } from '../config/env';

// Same ed25519/ss58-4450 recipe as the backend's (now-removed) server-side duniter-client.js,
// validated against a real chain in the plan's step-1 spike. Everything runs client-side,
// including signing (`transfer`, below) -- see useWallet.ts's `pay()` and
// pay-activity.service.js for why the transfer moved here instead of staying server-side.

let apiPromise: Promise<any> | undefined;

async function getApi() {
  if (apiPromise) return apiPromise;

  apiPromise = (async () => {
    const { ApiPromise, WsProvider } = await import('@polkadot/api');
    const { cryptoWaitReady } = await import('@polkadot/util-crypto');
    await cryptoWaitReady();

    let lastError: unknown;
    for (const endpoint of DUNITER_RPC_ENDPOINTS) {
      try {
        const provider = new WsProvider(endpoint, false);
        // WsProvider retries forever by default -- without a timeout, an unreachable endpoint
        // (e.g. a dev chain that's since been torn down) hangs `connect()` indefinitely, which
        // surfaced as an infinite loading skeleton with no error shown anywhere in the UI.
        await Promise.race([
          provider.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('connection timed out')), 8000))
        ]);
        return await ApiPromise.create({ provider, throwOnConnect: true });
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(`Could not connect to any Duniter RPC endpoint: ${(lastError as Error)?.message}`);
  })();

  apiPromise.catch(() => {
    apiPromise = undefined;
  });

  return apiPromise;
}

async function getKeyring() {
  const { Keyring } = await import('@polkadot/keyring');
  return new Keyring({ type: 'ed25519', ss58Format: DUNITER_SS58_FORMAT });
}

/** Generates a brand-new ed25519 keypair. Returns the mnemonic (to store as the wallet secret)
 *  and the derived Ğ1 address -- the frontend never persists the mnemonic beyond the immediate
 *  `create()` of the g1:WalletSecret Pod resource that follows (see useWallet). */
export async function createKeypair() {
  const { mnemonicGenerate, cryptoWaitReady } = await import('@polkadot/util-crypto');
  await cryptoWaitReady();
  const keyring = await getKeyring();
  const seed = mnemonicGenerate();
  const pair = keyring.addFromMnemonic(seed);
  return { seed, address: pair.address as string };
}

/** Whether `address` is a well-formed SS58 address for `DUNITER_SS58_FORMAT` (correct length +
 *  checksum) -- doesn't check the account actually exists on-chain. Used to validate raw Ğ1
 *  addresses pasted/scanned from non-ActivityPub wallets (Gecko, Cesium) before posting a
 *  payment activity that could otherwise only fail silently on the backend. */
export async function isValidAddress(address: string): Promise<boolean> {
  const { checkAddress } = await import('@polkadot/util-crypto');
  const { cryptoWaitReady } = await import('@polkadot/util-crypto');
  await cryptoWaitReady();
  try {
    const [isValid] = checkAddress(address, DUNITER_SS58_FORMAT);
    return isValid;
  } catch {
    return false;
  }
}

/** Free balance in centimes (integer, 100 = 1 Ğ1). */
export async function getBalance(address: string): Promise<number> {
  const api = await getApi();
  const info = await api.query.system.account(address);
  return info.data.free.toNumber();
}

export async function getExistentialDeposit(): Promise<number> {
  const api = await getApi();
  return api.consts.balances.existentialDeposit.toNumber();
}

/** Signs and submits a transferKeepAlive from the wallet identified by `seed` to `toAddress`,
 *  optionally with a `comment`. Resolves once the extrinsic is included in a block; throws on a
 *  dispatch error (including the recipient not meeting the existential deposit, or the sender
 *  being left below it).
 *
 *  Runs client-side, in the browser -- not on the backend. See pay-activity.service.js for why:
 *  a server-side transfer, triggered as a side effect of any `Offer{g1:Payment}` activity landing
 *  in the outbox, meant any app with generic outbox-post rights could move real money with no
 *  payment-specific consent gate. Signing here means the spend only ever happens through this
 *  app's own "Envoyer" button.
 *
 *  A comment can't be attached to a plain `transferKeepAlive` -- there's no memo field on a
 *  Substrate balance transfer. The chain indexer (duniter-squid's `data_handler.ts`) only links a
 *  comment to a transfer when a `system.remarkWithEvent` call sits in the *same extrinsic* as the
 *  `balances.transfer` event, so a comment has to be submitted as a
 *  `utility.batchAll([transferKeepAlive, remarkWithEvent])`, not as a separate call. Mirrors
 *  backend/lib/duniter-client.js's (now-removed) server-side version exactly. */
export async function transfer(seed: string, toAddress: string, amountCentimes: number, comment?: string): Promise<{ txHash: string; blockHash: string }> {
  const api = await getApi();
  const keyring = await getKeyring();
  const pair = keyring.addFromMnemonic(seed);

  const transferCall = api.tx.balances.transferKeepAlive(toAddress, amountCentimes);
  const call = comment ? api.tx.utility.batchAll([transferCall, api.tx.system.remarkWithEvent(comment)]) : transferCall;

  return new Promise((resolve, reject) => {
    call
      .signAndSend(pair, ({ status, dispatchError, txHash }: any) => {
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

// Default Cesium+ Pod instance for all networks, per Gecko's own bundled config
// (config/cesium_plus_endpoints.json in git.duniter.org/libs/durt) -- there's no per-network
// split in practice, every network resolves to the same community-run pod today.
const CESIUM_PLUS_ENDPOINTS: Record<string, string> = {
  g1: 'https://g1.data.e-is.pro',
  'g1-test': 'https://g1.data.e-is.pro'
};

/** Publishes (or updates) a Cesium+ Pod profile for this wallet, with `title` as its display
 *  name -- the mechanism real Ğ1 wallets (Gecko, Cesium, G1nkgo) use to show a human name instead
 *  of a raw address when scanning a QR code or looking up a contact, since PorteJunes has no
 *  ActivityPub presence from their point of view. Traced from Gecko's actual source
 *  (`CesiumPlusService`/`cesium_name_provider.dart` in git.duniter.org/clients/gecko and
 *  git.duniter.org/libs/durt): a self-declared Cesium+ name is only ever shown for an address
 *  with no on-chain (WoT) identity of its own, to avoid impersonating a certified member --
 *  exactly PorteJunes' hot wallets, which are explicitly non-member accounts (see the plan).
 *
 *  Best-effort: throws only on an actual HTTP failure from the pod; callers should treat this as
 *  optional (an unreachable pod shouldn't block wallet creation or app usage). Skips the write
 *  entirely if the pod already has this exact title, so calling this on every wallet-load is
 *  cheap and idempotent (1 GET, no POST) once published.
 *
 *  Wire format is the pod's document-signing convention, confirmed against
 *  `CesiumPlusService.signDocument` in durt2's source: SHA-256 of the compact JSON (hex,
 *  uppercase), Ed25519-signed over the UTF-8 bytes of THAT HEX STRING (not the raw hash bytes) --
 *  a Duniter4j/Cesium+-specific quirk, not a generic signing convention. */
export async function publishCesiumName(seed: string, title: string): Promise<void> {
  const endpoint = CESIUM_PLUS_ENDPOINTS[DUNITER_NETWORK];
  if (!endpoint) return;

  const { base58Encode, base64Encode, sha256AsU8a, cryptoWaitReady } = await import('@polkadot/util-crypto');
  const { stringToU8a, u8aToHex } = await import('@polkadot/util');
  await cryptoWaitReady();
  const keyring = await getKeyring();
  const pair = keyring.addFromMnemonic(seed);
  // Cesium+ identifies documents by the base58 (Bitcoin alphabet, no checksum) encoding of the
  // raw Ed25519 public key -- a Duniter-v1-era convention, distinct from the SS58 address used
  // on-chain for the same key.
  const pubkey = base58Encode(pair.publicKey);

  const existing: { _source?: { title?: string } } | null = await fetch(`${endpoint}/user/profile/${pubkey}`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
  if (existing?._source?.title === title) return;

  const payload = JSON.stringify({
    version: 2,
    title,
    issuer: pubkey,
    time: Math.floor(Date.now() / 1000)
  });
  const hashHex = u8aToHex(sha256AsU8a(stringToU8a(payload)), -1, false).toUpperCase();
  const signature = base64Encode(pair.sign(stringToU8a(hashHex)));
  // Hash + signature are prepended as the first fields of the original (unsigned) document,
  // matching the pod's expected wire format exactly -- not a generic JSON merge.
  const finalBody = `{"hash":"${hashHex}","signature":"${signature}",${payload.slice(1)}`;

  const url = existing?._source ? `${endpoint}/user/profile/${pubkey}/_update` : `${endpoint}/user/profile`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: finalBody
  });
  if (!res.ok) throw new Error(`Cesium+ pod refused profile publish: HTTP ${res.status}`);
}

export type HistoryEntry = {
  fromId: string;
  toId: string;
  amount: number;
  timestamp: string;
  comment?: string;
  /** The counterparty's Ğ1 identity (Web-of-Trust member username, e.g. their Cesium pseudo) --
   *  null if that side of the transfer has no linked identity, which is the normal case for a
   *  PorteJunes hot wallet (see the plan: hot wallets are explicitly non-member accounts). */
  fromIdentity?: string | null;
  toIdentity?: string | null;
};

/** Best-effort transfer history from the chain indexer -- returns [] on failure (no Pod-side
 *  fallback, see the plan's "Open risk: history depends on an experimental indexer"). Query
 *  shape verified against a live indexer.duniter.org response: `comment` is a `TxComment`
 *  object (needs a `{ remark }` subfield selection, not a bare scalar) -- getting that wrong
 *  fails the whole query, which this used to swallow silently as "no history". Also resolves
 *  each side's linked Duniter identity (real member username), when it has one. */
export async function getHistory(address: string): Promise<HistoryEntry[]> {
  if (!DUNITER_INDEXER_URL) return [];
  try {
    const response = await fetch(DUNITER_INDEXER_URL, {
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
    if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));
    return (data.transfers.nodes as any[]).map(n => ({
      fromId: n.fromId,
      toId: n.toId,
      amount: n.amount,
      timestamp: n.timestamp,
      comment: n.comment?.remark,
      fromIdentity: n.from?.linkedIdentity?.name ?? null,
      toIdentity: n.to?.linkedIdentity?.name ?? null
    }));
  } catch (e) {
    console.error('getHistory failed:', e);
    return [];
  }
}
