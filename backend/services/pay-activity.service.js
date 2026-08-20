const { PodActivitiesHandlerMixin } = require('@activitypods/app');
const duniterClient = require('../lib/duniter-client');

// Parses a `payto://g1/<address>` or `payto://g1-test/<address>` URI (see the plan's data model
// section for why `foaf:tipjar` holds this instead of a dereferenceable resource). `value` may
// be a bare string, a JSON-LD node reference (`{ id: "payto://..." }`), or an array of either
// (the Pod provider serializes `@id`-typed properties as node objects, not plain strings --
// confirmed during e2e testing, where `actor['foaf:tipjar']` was `{ id: 'payto://...' }`).
function parsePaytoUri(value) {
  const first = Array.isArray(value) ? value[0] : value;
  const uri = typeof first === 'string' ? first : first?.id;
  const match = /^payto:\/\/(g1|g1-test)\/(.+)$/.exec(uri || '');
  if (!match) return null;
  return { network: match[1], address: match[2] };
}

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
//   as bare `summary`). This was silently dropping every payment comment before it ever reached
//   `duniterClient.transfer` -- `pick()` only checked the prefixed and full-IRI forms.
const G1_NS = 'https://portejunes.example/ns/core#';
const AS_NS = 'https://www.w3.org/ns/activitystreams#';
function pick(obj, prefixed, ns) {
  const bare = prefixed.split(':')[1];
  return obj?.[prefixed] ?? obj?.[ns + bare] ?? obj?.[bare];
}

module.exports = {
  name: 'pay-activity',
  mixins: [PodActivitiesHandlerMixin],
  dependencies: ['wallet'],
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

      // Fires when the sender's own Pod records the `Offer` activity in their outbox. This is
      // where the actual Ğ1 transfer happens -- see the plan's "Important correction" section
      // for why there's no separate transfer API to call here: this *is* the transfer.
      async onEmit(ctx, activity, actorUri) {
        const amount = pick(activity.object, 'g1:amount', G1_NS);
        const comment = pick(activity.object, 'as:summary', AS_NS);
        const recipientWebId = activity.target;
        // Set instead of `target`/`to` when the recipient has no ActivityPub presence at all
        // (a plain Gecko/Cesium wallet, say) -- see PayerPage.tsx for the frontend side of this.
        const rawAddress = pick(activity.object, 'g1:address', G1_NS);

        try {
          if (!Number.isInteger(amount) || amount <= 0) {
            throw new Error(`Invalid g1:amount: ${amount}`);
          }

          let destinationAddress;
          if (recipientWebId) {
            const recipientActor = await ctx.call('activitypub.actor.get', { actorUri: recipientWebId });
            const recipientTipjar = parsePaytoUri(recipientActor?.['foaf:tipjar']);
            if (!recipientTipjar) {
              throw new Error(`${recipientWebId} has no foaf:tipjar (no Ğ1 wallet)`);
            }
            destinationAddress = recipientTipjar.address;
          } else if (rawAddress) {
            destinationAddress = rawAddress;
          } else {
            throw new Error('Pay activity has neither a target WebID nor a g1:address');
          }

          const senderWallet = await ctx.call('wallet.getOwn', { actorUri });
          const seed = pick(senderWallet, 'g1:seed', G1_NS);
          const { txHash } = await duniterClient.transfer(seed, destinationAddress, amount, comment);

          // No "payment sent" notification to the sender: every `pod-notifications.send` call
          // becomes a real email (see mail-notifications.js in the Pod provider backend -- it
          // auto-relays any apods:Notification landing in a user's inbox, unconditionally, once
          // SMTP is configured). The sender already gets immediate feedback from the outbox
          // POST succeeding and their balance updating; the useful notification -- to the
          // person who didn't initiate anything and has no other way to know -- is the
          // recipient's, below.
          this.logger.info(`Pay ${activity.id}: sent ${amount} centimes to ${destinationAddress} (${txHash})`);
        } catch (e) {
          this.logger.error(`Pay ${activity.id} failed: ${e.message}`);
          await ctx.call('pod-notifications.send', {
            template: {
              title: {
                en: `Payment failed: ${e.message}`,
                fr: `Échec du paiement : ${e.message}`
              }
            },
            activity,
            context: activity.id,
            recipientUri: actorUri
          });
        }
      },

      // Fires when the recipient's Pod receives the `Offer` activity in their inbox -- purely a
      // notification, the money has already moved on-chain by the time this runs (see the plan:
      // "Pay is more of a notification").
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
