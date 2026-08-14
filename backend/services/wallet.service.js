const urlJoin = require('url-join');
const { PodResourcesHandlerMixin } = require('@activitypods/app');
const CONFIG = require('../config/config');

// Gives this service post/list/get/patch actions for free, resolved against this app's own
// granted Data Registration for g1:WalletSecret (see data-grants.getContainerByShapeTree).
// Only ever called from pay-activity.service.js, to read the sender's stored secret when
// signing a transfer -- wallet *creation* happens in the frontend (see the plan's "Revision made
// during implementation" section for why: there's no established convention in this framework
// for the frontend to call custom backend RPC, whereas creating a Pod resource the user already
// has full rights on is exactly what the standard dataProvider is for).
module.exports = {
  name: 'wallet',
  mixins: [PodResourcesHandlerMixin],
  settings: {
    shapeTreeUri: urlJoin(CONFIG.PORTEJUNES_SHAPE_REPOSITORY_URL, 'shapetrees/g1/WalletSecret.json')
  },
  actions: {
    /** The sender's own wallet secret (seed + address), as stored by the frontend's useWallet. */
    async getOwn(ctx) {
      const { actorUri } = ctx.params;
      // `list`/`get` (from PodResourcesHandlerMixin, via pod-resources.*) return the raw proxied
      // response `{ ok, body, headers, status, statusText }` -- see cleanup.service.js's
      // `const { body } = await ctx.call('events.list', ...)` in welcometomyplace for the same
      // access pattern on another PodResourcesHandlerMixin-based service.
      const { body: container } = await this.actions.list({ actorUri }, { parentCtx: ctx });
      const items = container?.['ldp:contains'] || [];
      if (items.length === 0) {
        throw new Error(`No g1:WalletSecret found for ${actorUri} -- the frontend should have created one`);
      }
      // One wallet per user is all v1 needs; if several exist (shouldn't happen), use the first.
      const { body: resource } = await this.actions.get(
        { resourceUri: items[0].id || items[0]['@id'], actorUri },
        { parentCtx: ctx }
      );
      return resource;
    }
  }
};
