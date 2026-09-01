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

// Keyed by webId, so a React 18 StrictMode dev double-mount (mount, cleanup, mount again) awaits
// the same in-flight creation instead of starting a duplicate one -- see the effect below for why
// that matters here specifically.
const walletCreationInFlight = new Map<string, Promise<string>>();

/**
 * The logged-in user's own wallet: creates one on first use (see the plan's "Revision made
 * during implementation" -- generation happens here, in the browser, immediately followed by
 * persisting to the Pod, never touching localStorage) and exposes its public address, live
 * balance, and a `pay()` to send Ğ1. The seed is never persisted client-side (no localStorage),
 * but `pay()` does read it back from the Pod, in memory, to sign each transfer -- see
 * pay-activity.service.js for why that moved here instead of happening server-side.
 */
const useWallet = () => {
  const { data: ownActor } = useOwnActor();
  const webId = ownActor?.id;

  const { result, query } = useList<WalletSecretRecord>({
    resource: 'wallet',
    queryOptions: { enabled: !!webId }
  });

  const [address, setAddress] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Guards against creating more than one wallet per session. A plain `useRef` alone isn't
  // enough: in dev, React 18 StrictMode intentionally mounts this component twice (mount,
  // cleanup, mount again) to surface exactly this kind of bug, and a ref is recreated on each
  // fresh mount so it doesn't survive that -- `walletCreationInFlight` does, since both mounts
  // then attach to the same promise instead of racing to create two wallets. This actually bit
  // us: two `g1:WalletSecret` resources (and two accumulated `foaf:tipjar` values, see below) got
  // created for the same account during testing, and payments silently went to whichever one
  // wasn't the one being displayed.
  const attempted = useRef(false);

  useEffect(() => {
    if (!webId || query.isLoading || address || attempted.current) return;

    const existing = result?.data?.[0];
    if (existing) {
      setAddress(existing['g1:address']);
      return;
    }

    attempted.current = true;

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
          // DELETE the previous value (if any) in the same update, instead of a bare INSERT DATA
          // -- `foaf:tipjar` is meant to hold the account's one current wallet, and a blind
          // INSERT left every past `g1:WalletSecret` (including ones from aborted/duplicate
          // creations) permanently listed too. Payments then resolved to `foaf:tipjar`'s
          // arbitrary first value, which had no guaranteed relationship to the address actually
          // shown as "yours".
          await fetchJson(
            webId,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/sparql-update' },
              body: `PREFIX foaf: <http://xmlns.com/foaf/0.1/> DELETE { <${webId}> foaf:tipjar ?old } INSERT { <${webId}> foaf:tipjar <${paytoUri}> } WHERE { OPTIONAL { <${webId}> foaf:tipjar ?old } }`
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

          return newAddress;
        } finally {
          walletCreationInFlight.delete(webId);
        }
      })();
      walletCreationInFlight.set(webId, creation);
    }

    setCreating(true);
    creation
      .then(newAddress => setAddress(newAddress))
      .catch(e => {
        setCreationError(e.message);
        attempted.current = false; // allow retrying on next render if creation genuinely failed
      })
      .finally(() => setCreating(false));
  }, [webId, query.isLoading, result?.data, address, ownActor]);

  // Covers wallets created before this feature existed (or if a previous publish attempt
  // failed): re-checks once per mount, independent of the creation effect above (which only
  // has the seed in scope at the moment of creation, not on a later reload). publishCesiumName
  // is a no-op HTTP GET once the pod already has this title, so this is cheap to repeat.
  const cesiumChecked = useRef(false);
  useEffect(() => {
    if (cesiumChecked.current) return;
    const existing = result?.data?.[0];
    const handle = ownActor && formatHandle(ownActor);
    const seed = existing?.['g1:seed'];
    if (!seed || !handle) return;
    cesiumChecked.current = true;
    publishCesiumName(seed, handle).catch(e => console.error('Cesium+ profile publish failed:', e));
  }, [result?.data, ownActor]);

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
      const seed = result?.data?.[0]?.['g1:seed'];
      if (!seed) throw new Error('Portefeuille pas encore chargé, réessayez dans un instant.');
      const receipt = await transfer(seed, toAddress, amountCentimes, comment);
      await balanceQuery.refetch();
      return receipt;
    },
    [result?.data, balanceQuery]
  );

  return {
    address,
    tipjar: address ? parsePaytoUri(formatPaytoUri(DUNITER_NETWORK, address)) : null,
    balance: balanceQuery.data ?? null,
    isLoading: query.isLoading || creating,
    error: creationError || balanceQuery.error?.message || null,
    pay
  };
};

export default useWallet;
