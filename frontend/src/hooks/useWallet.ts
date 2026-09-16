import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useList } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';

import { authProvider, dataProvider } from '../providers';
import useOwnActor from './useOwnActor';
import { createKeypair, getBalance, publishCesiumName, transfer } from './useDuniter';
import { formatPaytoUri, parsePaytoUri } from '../utils/payto';
import { formatHandle } from '../utils/handle';
import { DUNITER_NETWORK } from '../config/env';
import type { WalletSecretRecord } from '../types';

// Keyed by webId: several components call useWallet() at once (WalletSidebar + the current
// page), and in dev React StrictMode double-mounts each of them -- a second `createWallet()`
// call while one is already running must await the same in-flight creation instead of starting
// a duplicate one. This actually bit us when creation was automatic: two `g1:WalletSecret`
// resources (and two accumulated `foaf:tipjar` values, see below) got created for the same
// account, and payments silently went to whichever one wasn't the one being displayed.
const walletCreationInFlight = new Map<string, Promise<string>>();

/**
 * The logged-in user's own wallet, read from the Pod. Exposes its public address, live balance,
 * a `pay()` to send Ğ1, and `createWallet()` for the one-time setup screen (WalletSetupPage) --
 * creation is deliberately NOT automatic anymore: generating a hot wallet whose secret lives on
 * the Pod is something the user should do knowingly, after being told what it is and where it's
 * stored. Generation happens here, in the browser, immediately followed by persisting to the
 * Pod, never touching localStorage; `pay()` reads the seed back from the Pod, in memory, to sign
 * each transfer -- see pay-activity.service.js for why that moved here instead of happening
 * server-side.
 */
const useWallet = () => {
  const { data: ownActor, refetch: refetchOwnActor } = useOwnActor();
  const webId = ownActor?.id;

  const { result, query } = useList<WalletSecretRecord>({
    resource: 'wallet',
    queryOptions: { enabled: !!webId }
  });

  const existing = result?.data?.[0];
  const address = existing?.['g1:address'] ?? null;
  // `null` while we don't know yet (not logged in / list still loading), so callers can tell
  // "no wallet, show the setup screen" apart from "still checking".
  const hasWallet: boolean | null = !webId || query.isLoading ? null : !!existing;

  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const createWallet = useCallback(async () => {
    if (!webId) return;

    let creation = walletCreationInFlight.get(webId);
    if (!creation) {
      creation = (async () => {
        try {
          const { seed, address: newAddress } = await createKeypair();
          await dataProvider.create({
            resource: 'wallet',
            variables: { 'g1:seed': seed, 'g1:address': newAddress }
          });

          const session = authProvider.getSession();
          const paytoUri = formatPaytoUri(DUNITER_NETWORK, newAddress);
          // DELETE the previous value(s) (if any) in the same update, instead of a bare INSERT
          // DATA -- `foaf:tipjar` is meant to hold the account's one current wallet, and a blind
          // INSERT left every past `g1:WalletSecret` (including ones from aborted/duplicate
          // creations) permanently listed too. Payments then resolved to `foaf:tipjar`'s
          // arbitrary first value, which had no guaranteed relationship to the address actually
          // shown as "yours". The Pod provider only accepts ground `INSERT DATA`/`DELETE DATA`
          // (no `DELETE … WHERE` with a variable, see @semapps/ldp's patch action), so the old
          // values have to be spelled out: re-read the actor first rather than trusting
          // useOwnActor's 5-minute cache.
          const { data: freshActor } = await refetchOwnActor();
          const oldValues = ([] as unknown[])
            .concat(freshActor?.['foaf:tipjar'] ?? [])
            .map(v => (typeof v === 'string' ? v : (v as { id?: string })?.id))
            .filter((v): v is string => !!v);
          const deleteData = oldValues.length
            ? `DELETE DATA { ${oldValues.map(v => `<${webId}> foaf:tipjar <${v}> .`).join(' ')} };`
            : '';
          await fetchJson(
            webId,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/sparql-update' },
              body: `PREFIX foaf: <http://xmlns.com/foaf/0.1/> ${deleteData} INSERT DATA { <${webId}> foaf:tipjar <${paytoUri}> . }`
            },
            session?.token
          );

          // Best-effort: publishes a Cesium+ Pod profile (see useDuniter.ts) so real Ğ1 wallets
          // (Gecko, Cesium, G1nkgo) show this handle instead of a raw address when scanning a QR
          // code or looking up a contact -- these apps have no notion of ActivityPub/PorteJunes.
          // Uses the seed while it's still in scope here, rather than reading it back from the
          // Pod a second time right after writing it.
          const handle = ownActor && formatHandle(ownActor);
          if (handle) {
            publishCesiumName(seed, handle).catch(e => console.error('Cesium+ profile publish failed:', e));
          }

          // `address`/`pay()` derive from the list query, so refresh it before resolving --
          // every useWallet() instance shares the same query key and picks the new wallet up.
          await query.refetch();

          return newAddress;
        } finally {
          walletCreationInFlight.delete(webId);
        }
      })();
      walletCreationInFlight.set(webId, creation);
    }

    setCreating(true);
    setCreationError(null);
    try {
      await creation;
    } catch (e) {
      setCreationError((e as Error).message);
      throw e;
    } finally {
      setCreating(false);
    }
  }, [webId, ownActor, refetchOwnActor, query]);

  // Covers wallets created before the Cesium+ feature existed (or if a previous publish attempt
  // failed): re-checks once per mount. publishCesiumName is a no-op HTTP GET once the pod
  // already has this title, so this is cheap to repeat.
  const cesiumChecked = useRef(false);
  useEffect(() => {
    if (cesiumChecked.current) return;
    const handle = ownActor && formatHandle(ownActor);
    const seed = existing?.['g1:seed'];
    if (!seed || !handle) return;
    cesiumChecked.current = true;
    publishCesiumName(seed, handle).catch(e => console.error('Cesium+ profile publish failed:', e));
  }, [existing, ownActor]);

  // Polled, not fetched once: a plain one-shot fetch here left the balance stuck at whatever it
  // was when the wallet first loaded, so the "your balance will update once confirmed" message
  // shown after sending a payment (see PayerPage.tsx) was never actually true. 8s is a
  // reasonably snappy compromise for "did my payment land" without hammering the public RPC
  // nodes on every render.
  const balanceQuery = useQuery({
    queryKey: ['balance', address],
    queryFn: () => getBalance(address!),
    enabled: !!address,
    refetchInterval: 8000
  });

  // Signs and broadcasts the transfer directly from here, using the seed already sitting in
  // `result.data` (the same `wallet` resource `address` was derived from) -- no extra fetch.
  // Throws (rather than swallowing) on a chain-level failure, e.g. insufficient balance, so
  // PayerPage.tsx's caller sees the real error instead of a payment that silently never landed.
  const pay = useCallback(
    async (toAddress: string, amountCentimes: number, comment?: string) => {
      const seed = existing?.['g1:seed'];
      if (!seed) throw new Error('Portefeuille pas encore chargé, réessayez dans un instant.');
      const receipt = await transfer(seed, toAddress, amountCentimes, comment);
      await balanceQuery.refetch();
      return receipt;
    },
    [existing, balanceQuery]
  );

  return {
    address,
    hasWallet,
    tipjar: address ? parsePaytoUri(formatPaytoUri(DUNITER_NETWORK, address)) : null,
    balance: balanceQuery.data ?? null,
    isLoading: query.isLoading || creating,
    creating,
    creationError,
    error: creationError || balanceQuery.error?.message || null,
    createWallet,
    pay
  };
};

export default useWallet;
