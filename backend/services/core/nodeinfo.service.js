const urlJoin = require('url-join');
const { NodeinfoService } = require('@semapps/nodeinfo');
const CONFIG = require('../../config/config');
const pkg = require('../../package.json');

module.exports = {
  mixins: [NodeinfoService],
  settings: {
    baseUrl: CONFIG.HOME_URL,
    software: {
      name: 'portejunes',
      version: pkg.version
    },
    protocols: ['activitypub'],
    metadata: {
      frontend_url: CONFIG.FRONT_URL,
      login_url: CONFIG.FRONT_URL && urlJoin(CONFIG.FRONT_URL, 'login'),
      logout_url: CONFIG.FRONT_URL && urlJoin(CONFIG.FRONT_URL, 'login?logout=true')
    }
  },
  actions: {
    async getUsersCount(ctx) {
      // Count the URIs directly as 'system': the nodeinfo route is public, so listing the container
      // would read it as 'anon' and the WAC permissions would hide every registration.
      const containerUri = await ctx.call('app-registrations.getContainerUri');
      const registrationsUris = await ctx.call('ldp.container.getUris', { containerUri });
      return {
        total: registrationsUris.length,
        activeHalfYear: registrationsUris.length,
        activeMonth: registrationsUris.length
      };
    }
  }
};
