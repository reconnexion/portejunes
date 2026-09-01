const { PodActivitiesHandlerMixin } = require('@activitypods/app');

// The Pod provider's JSON-LD serialization doesn't reliably compact properties to the form you'd
// expect, so this checks every form a property might come back as, not just the "natural" one:
// - custom-namespace properties (g1:amount, g1:address) sometimes don't compact to the `g1:`
//   prefix even though it's registered, and show up as the full IRI instead -- confirmed during
//   e2e testing.
// - standard AS2 properties (as:summary) go the OTHER way: the official AS2 JSON-LD context
//   (https://www.w3.org/ns/activitystreams) defines `summary` as the preferred compacted term
//   for that IRI, so it comes back as the *bare* term, never `as:summary` -- confirmed by
//   `activity.target` a few lines below already being read bare, and directly verified against
//   this service's own stored data via SPARQL (predicate is the full
//   `.../activitystreams#summary` IRI; the compacted JSON-LD handed to this handler exposes that
//   as bare `summary`).
const G1_NS = 'https://portejunes.example/ns/core#';
const AS_NS = 'https://www.w3.org/ns/activitystreams#';
function pick(obj, prefixed, ns) {
  const bare = prefixed.split(':')[1];
  return obj?.[prefixed] ?? obj?.[ns + bare] ?? obj?.[bare];
}

module.exports = {
  name: 'pay-activity',
  mixins: [PodActivitiesHandlerMixin],
  activities: {
    // Wraps a `g1:Payment` custom OBJECT inside a standard AS2 `Offer` activity, rather than
    // inventing a new top-level `Pay` ACTIVITY type. This isn't a semantic preference -- e2e
    // testing showed a brand-new custom *activity* type's `@type` gets serialized as an unusable
    // blank-node placeholder when the Pod provider returns it cross-Pod (confirmed by direct
    // inspection: same request, only the activity type differed, and every standard AS2 verb
    // compacted correctly while `Pay` didn't). Custom *object* types don't hit this, matching
    // lentraide's proven-working `{ type: 'Announce', object: { type: 'maid:Offer' } }` pattern.
    pay: {
      match: { type: 'Offer', object: { type: 'g1:Payment' } },

      // Deliberately no `onEmit`: earlier, this is where the actual Ğ1 transfer happened, signed
      // server-side with the sender's stored wallet secret, as a side effect of ANY `Offer{g1:
      // Payment}` activity landing in the sender's own outbox. That meant any app holding the
      // (common, broad) `apods:PostOutbox` access need could move real money by posting one --
      // there was no payment-specific consent gate, just a generic ActivityPub permission.
      // The transfer now happens client-side in this app's own frontend (see PayerPage.tsx),
      // signed and broadcast to the chain directly, *before* this activity is posted at all --
      // only PorteJunes' own UI ever touches the wallet secret to sign a spend. This activity is
      // now purely a receipt/notification, posted after the fact, and only `onReceive` (below)
      // does anything with it. Another RSU app wanting to let a user pay someone doesn't post
      // this activity itself -- it redirects to PorteJunes with the recipient/amount preselected
      // (see PayerPage.tsx's `to`/`amount` query params), so the actual spend still only ever
      // happens through this app's own consent screen.

      // Fires when the recipient's Pod receives the `Offer` activity in their inbox -- purely a
      // notification; the money already moved on-chain, client-side, before this was even posted.
      async onReceive(ctx, activity, actorUri) {
        const amount = pick(activity.object, 'g1:amount', G1_NS);
        const comment = pick(activity.object, 'as:summary', AS_NS);

        await ctx.call('pod-notifications.send', {
          template: {
            title: {
              en: comment
                ? `You received ${(amount / 100).toFixed(2)} Ğ1: "${comment}"`
                : `You received ${(amount / 100).toFixed(2)} Ğ1`,
              fr: comment
                ? `Vous avez reçu ${(amount / 100).toFixed(2)} Ğ1 : « ${comment} »`
                : `Vous avez reçu ${(amount / 100).toFixed(2)} Ğ1`
            }
          },
          activity,
          context: activity.id,
          recipientUri: actorUri
        });
      }
    }
  }
};
