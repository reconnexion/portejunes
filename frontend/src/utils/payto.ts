export type Tipjar = { network: 'g1' | 'g1-test'; address: string };

type PaytoValue = string | { id: string } | (string | { id: string })[] | null | undefined;

/** Parses a `payto://g1/<address>` or `payto://g1-test/<address>` URI -- see the plan's data
 *  model section for why `foaf:tipjar` holds this instead of a dereferenceable resource. `value`
 *  may be a bare string, a JSON-LD node reference (`{ id: "payto://..." }`), or an array of
 *  either (the Pod provider serializes `@id`-typed properties as node objects, not plain
 *  strings -- confirmed during e2e testing). */
export function parsePaytoUri(value?: PaytoValue): Tipjar | null {
  const first = Array.isArray(value) ? value[0] : value;
  const uri = typeof first === 'string' ? first : first?.id;
  const match = /^payto:\/\/(g1|g1-test)\/(.+)$/.exec(uri || '');
  if (!match) return null;
  return { network: match[1] as Tipjar['network'], address: match[2] };
}

export function formatPaytoUri(network: Tipjar['network'], address: string): string {
  return `payto://${network}/${address}`;
}
