import { useEffect, useRef, useState } from 'react';
import { useList } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';

import { authProvider, dataProvider } from '../providers';
import useOwnActor from './useOwnActor';
import { createKeypair, getBalance, publishCesiumName } from './useDuniter';
import { formatPaytoUri, parsePaytoUri } from '../utils/payto';
import { formatHandle } from '../utils/handle';
import { DUNITER_NETWORK } from '../config/env';
import type { WalletSecretRecord } from '../types';

/**
 * The logged-in user's own wallet: creates one on first use (see the plan's "Revision made
 * during implementation" -- generation happens here, in the browser, immediately followed by
 * persisting to the Pod, never touching localStorage) and exposes its public address + live
 * balance. The private key itself is never read back into the UI after creation.
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
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guards against creating more than one wallet per session. Needed because the imperative
  // `dataProvider.create()` call below doesn't go through Refine's `useList` cache, so
  // `result.data` never reflects the newly created resource -- without this ref, the effect
  // would see "still no wallet" on every re-run (e.g. once `creating` flips back to false) and
  // create another one, indefinitely.
  const attempted = useRef(false);

  useEffect(() => {
    if (!webId || query.isLoading || address || attempted.current) return;

    const existing = result?.data?.[0];
    if (existing) {
      setAddress(existing['g1:address']);
      return;
    }

    attempted.current = true;
    setCreating(true);

    (async () => {
      try {
        const { seed, address: newAddress } = await createKeypair();
        await dataProvider.create({
          resource: 'wallet',
          variables: { 'g1:seed': seed, 'g1:address': newAddress }
        });

        const session = authProvider.getSession();
        const paytoUri = formatPaytoUri(DUNITER_NETWORK, newAddress);
        await fetchJson(
          webId,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/sparql-update' },
            body: `INSERT DATA { <${webId}> <http://xmlns.com/foaf/0.1/tipjar> <${paytoUri}> }`
          },
          session?.token
        );

        setAddress(newAddress);

        // Best-effort: publishes a Cesium+ Pod profile (see useDuniter.ts) so real Ğ1 wallets
        // (Gecko, Cesium, G1nkgo) show this handle instead of a raw address when scanning a QR
        // code or looking up a contact -- these apps have no notion of ActivityPub/PorteJunes.
        // Uses the seed while it's still in scope here, before it's discarded (see the file
        // doc comment: never read back into the UI after creation).
        const handle = ownActor && formatHandle(ownActor);
        if (handle) {
          publishCesiumName(seed, handle).catch(e => console.error('Cesium+ profile publish failed:', e));
        }
      } catch (e: any) {
        setError(e.message);
        attempted.current = false; // allow retrying on next render if creation genuinely failed
      } finally {
        setCreating(false);
      }
    })();
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

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getBalance(address)
      .then(b => !cancelled && setBalance(b))
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [address]);

  return {
    address,
    tipjar: address ? parsePaytoUri(formatPaytoUri(DUNITER_NETWORK, address)) : null,
    balance,
    isLoading: query.isLoading || creating,
    error
  };
};

export default useWallet;
