import { useQueries } from '@tanstack/react-query';
import { useList as useRefineList } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';

import { authProvider } from '../providers';
import { parsePaytoUri } from '../utils/payto';
import { formatHandle } from '../utils/handle';
import type { ProfileRecord } from '../types';

export type DirectoryEntry = { webId: string; name: string; handle: string | null; photo?: string };

/** Resolves Ğ1 addresses back to a known PorteJunes contact (name/handle/photo), for addresses
 *  that have no linked Duniter identity to fall back on (i.e. other hot wallets -- see the plan:
 *  a hot wallet is explicitly a non-member account, so the chain indexer's identity lookup never
 *  resolves it; this is the only way to put a name to it). Shares its per-contact query cache
 *  with useTipjar (same queryKey and result shape), so visiting Contacts/Payer first avoids
 *  re-fetching. */
const useContactDirectory = () => {
  const session = authProvider.getSession();

  const { result, query } = useRefineList<ProfileRecord>({
    resource: 'profile',
    pagination: { pageSize: 200 }
  });
  const profiles = result?.data || [];

  const tipjarQueries = useQueries({
    queries: profiles.map(profile => ({
      queryKey: ['tipjar', profile.describes],
      queryFn: async () => {
        const { json: actor } = await fetchJson(profile.describes!, {}, session?.token);
        return { tipjar: parsePaytoUri(actor['foaf:tipjar']), handle: formatHandle(actor) };
      },
      enabled: !!profile.describes,
      staleTime: 5 * 60 * 1000
    }))
  });

  const byAddress = new Map<string, DirectoryEntry>();
  profiles.forEach((profile, i) => {
    const data = tipjarQueries[i]?.data;
    if (data?.tipjar && profile.describes) {
      byAddress.set(data.tipjar.address, {
        webId: profile.describes,
        name: profile['vcard:given-name'] || profile.describes,
        handle: data.handle,
        photo: profile['vcard:photo']
      });
    }
  });

  return {
    getContact: (address: string) => byAddress.get(address),
    isLoading: query.isLoading || tipjarQueries.some(q => q.isLoading)
  };
};

export default useContactDirectory;
