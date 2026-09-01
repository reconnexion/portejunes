const path = require('path');
const { CoreService } = require('@semapps/core');
const { apods, notify, interop, oidc } = require('@semapps/ontologies');
const CONFIG = require('../../config/config');

// Ğ1 (June, Duniter's libre currency) vocabulary used by this app.
// Not published on shapes.activitypods.org (this app hosts its own shapetree instead, see
// shapes/dist and docker-compose-shapes.yml) since it's specific to PorteJunes, not a shared
// ActivityPods type. It's served from its own dedicated origin, not this backend's -- app.service's
// access-need registration dereferences shapeTreeUri through ldp.remote.get, which refuses any
// resourceUri under this app's own baseUrl (see @semapps/ldp's isRemote action) to keep apps from
// self-referencing their own ACL-protected resources through the anonymous network-fetch path.
const g1 = {
  prefix: 'g1',
  namespace: 'https://portejunes.example/ns/core#',
  jsonldContext: {
    'g1:seed': { '@type': 'xsd:string' },
    'g1:address': { '@type': 'xsd:string' },
    'g1:amount': { '@type': 'xsd:integer' },
    // `Pay` is an activitystreams-shaped custom type, not a standard AS2 term, so it has no
    // mapping in this app's own merged context (unlike this app's frontend requests, which merge
    // in the full activitystreams context too). Without an explicit mapping here, a `Pay`
    // activity fetched cross-Pod via pod-resources.get (which only sends this context, not
    // activitystreams') compacts its `@type` down to an unusable blank-node placeholder, and
    // pay-activity.service.js's `match: { type: 'Pay' }` never matches -- confirmed by directly
    // inspecting the dereferenced activity during the e2e test's Pay flow.
    Pay: 'https://www.w3.org/ns/activitystreams#Pay'
  }
};

module.exports = {
  mixins: [CoreService],
  settings: {
    baseUrl: CONFIG.HOME_URL,
    baseDir: path.resolve(__dirname, '../..'),
    triplestore: {
      url: CONFIG.SPARQL_ENDPOINT,
      user: CONFIG.JENA_USER,
      password: CONFIG.JENA_PASSWORD,
      mainDataset: CONFIG.MAIN_DATASET
    },
    ontologies: [apods, notify, interop, oidc, g1],
    activitypub: {
      queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
    },
    api: {
      port: CONFIG.PORT
    },
    ldp: {
      resourcesWithContainerPath: false
    },
    void: false,
    webid: false
  }
};
