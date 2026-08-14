const { AuthAccountService } = require('@semapps/auth');
const { TripleStoreAdapter } = require('@semapps/triplestore');
const CONFIG = require('../../config/config');

module.exports = {
  mixins: [AuthAccountService],
  adapter: new TripleStoreAdapter({ type: 'AuthAccount', dataset: CONFIG.AUTH_ACCOUNTS_DATASET_NAME })
};
