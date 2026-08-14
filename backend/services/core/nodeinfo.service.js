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
  }
};
