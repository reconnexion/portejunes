/** Parses Gecko/Ğ1nkgo's payment URI scheme (`g1://ADDRESS?amount=X&comment=Y`, or `june://` for
 *  backward compat), confirmed against Gecko's own `payment_uri_service.dart`. Also accepts a
 *  bare address with no scheme, since Gecko's own scanner falls back to that too. Returns null
 *  for anything else (including WebIDs, handled separately). */
export type G1PaymentUri = { address: string; amount?: number; comment?: string };

const SCHEME_PREFIXES = ['g1://', 'june://'];

export function parseG1Uri(input: string): G1PaymentUri | null {
  const trimmed = input.trim();

  const prefix = SCHEME_PREFIXES.find(p => trimmed.startsWith(p));
  if (prefix) {
    const withoutScheme = trimmed.slice(prefix.length);
    const [addressPart, queryString] = withoutScheme.split('?');
    if (!addressPart) return null;
    const params = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
    const amount = params.amount ? Number(params.amount.replace(',', '.')) : undefined;
    return { address: addressPart, amount: Number.isFinite(amount) ? amount : undefined, comment: params.comment };
  }

  // Bare address, no scheme -- e.g. pasted directly rather than scanned.
  if (/^g1[a-zA-Z0-9]{40,55}$/.test(trimmed)) {
    return { address: trimmed };
  }

  return null;
}
