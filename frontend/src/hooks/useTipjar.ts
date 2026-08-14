import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@activitypods/refine-providers/utils';

import { authProvider } from '../providers';
import { parsePaytoUri } from '../utils/payto';
import { formatHandle } from '../utils/handle';

/** Resolves an actor (WebID) URI's `foaf:tipjar` to a parsed Ğ1 address, if they have a wallet,
 *  plus their `@user@domain` handle (see utils/handle.ts) -- both come off the same actor-document
 *  fetch, so bundled here rather than as a separate hook/request. WebID documents are public, so
 *  this works for any actor, not just the logged-in user. Query result shape (and queryKey) is
 *  shared with useContactDirectory's per-contact lookups, so visiting either page first avoids
 *  re-fetching the other. */
const useTipjar = (actorUri?: string) => {
  const session = authProvider.getSession();

  return useQuery({
    queryKey: ['tipjar', actorUri],
    queryFn: async () => {
      const { json: actor } = await fetchJson(actorUri!, {}, session?.token);
      return { tipjar: parsePaytoUri(actor['foaf:tipjar']), handle: formatHandle(actor) };
    },
    enabled: !!actorUri,
    staleTime: 5 * 60 * 1000
  });
};

export default useTipjar;
