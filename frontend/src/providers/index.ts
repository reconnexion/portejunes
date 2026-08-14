import { authProvider as apAuthProvider, dataProvider as apDataProvider } from '@activitypods/refine-providers';

import urlJoin from '../utils/urlJoin';
import { BACKEND_URL, CLIENT_ID, SHAPE_REPOSITORY_URL, PORTEJUNES_SHAPE_REPOSITORY_URL } from '../config/env';

export const authProvider = apAuthProvider({
  clientId: CLIENT_ID
});

/** Merges in the backend's own JSON-LD context (`g1`, `apods`, `interop`... prefixes, with
 *  reference properties correctly typed `@type: "@id"`) -- without it, e.g. `g1:amount` on a
 *  `Pay` activity would round-trip as an untyped string instead of an integer. */
const JSON_CONTEXT = ['https://www.w3.org/ns/activitystreams', urlJoin(new URL(BACKEND_URL).origin, '.well-known/context.jsonld')];

/** Resources living on the logged-in user's own Pod, discovered via shape trees. */
export const dataProvider = apDataProvider({
  authProvider,
  jsonContext: JSON_CONTEXT,
  resources: {
    wallet: {
      shapeTreeUri: urlJoin(PORTEJUNES_SHAPE_REPOSITORY_URL, 'shapetrees/g1/WalletSecret.json')
    },
    profile: {
      shapeTreeUri: urlJoin(SHAPE_REPOSITORY_URL, 'shapetrees/as/Profile')
    }
  }
});
