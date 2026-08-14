/** Formats an actor as a Fediverse-style `@username@domain` handle, e.g. `@test1@podprovider.org`
 *  -- the same convention (and the same two properties, `preferredUsername` + the WebID's own
 *  host) the Pod provider's own frontend already uses for `UsernameField`/`ContactCard`, and
 *  resolvable via its `@semapps/webfinger` service. No new identity system: every PorteJunes
 *  actor already has both, since the wallet is attached to a Pod-provider account, not a
 *  PorteJunes-specific one. */
export function formatHandle(actor: Record<string, any>): string | null {
  if (!actor?.id || !actor?.preferredUsername) return null;
  return `@${actor.preferredUsername}@${new URL(actor.id).host}`;
}
