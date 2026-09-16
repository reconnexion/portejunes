/** Centralised, typed access to the app's Vite env vars (see `.env` / `.env.local`). */

export const APP_NAME = (import.meta.env.VITE_APP_NAME as string) || 'PorteJunes';
export const APP_LANG = (import.meta.env.VITE_APP_LANG as string) || 'fr';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string;
// The app's Solid-OIDC client_id: the app actor the backend's AppService creates/hosts
// dynamically at `${HOME_URL}as/actor/app` (see backend/services/app.service.js) -- unlike
// @activitypods/refine-providers' no-backend example, this isn't a static frontend file.
export const CLIENT_ID = import.meta.env.VITE_CLIENT_ID as string;

/** Shape trees, standard (as:Profile, ...) and this app's own (g1:WalletSecret), all published on
 *  shapes.activitypods.org. */
export const SHAPE_REPOSITORY_URL = (import.meta.env.VITE_SHAPE_REPOSITORY_URL as string) || 'https://shapes.activitypods.org/';

/** When set, the login page offers this single Pod provider instead of the public list. */
export const DEFAULT_POD_PROVIDER = import.meta.env.VITE_POD_PROVIDER_URL as string | undefined;

/// Duniter / Ğ1 -- browser talks directly to the chain for reads (balance, history); see the
/// plan's "Revision made during implementation" section for why. `SEMAPPS_DUNITER_*` server-side
/// env vars are the same values, kept in sync manually.
export const DUNITER_NETWORK = ((import.meta.env.VITE_DUNITER_NETWORK as string) || 'g1-test') as 'g1' | 'g1-test';
export const DUNITER_RPC_ENDPOINTS = ((import.meta.env.VITE_DUNITER_RPC_ENDPOINTS as string) || '').split(',').filter(Boolean);
export const DUNITER_INDEXER_URL = import.meta.env.VITE_DUNITER_INDEXER_URL as string;
export const DUNITER_SS58_FORMAT = Number(import.meta.env.VITE_DUNITER_SS58_FORMAT || 4450);
