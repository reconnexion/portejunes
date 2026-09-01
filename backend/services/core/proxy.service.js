const { ProxyService } = require('@semapps/crypto');

// Needed by solid-notifications.listener.register (used by pod-activities-watcher to subscribe
// to a user's inbox) to make signed cross-domain requests -- without it, listener registration
// fails with "Service 'signature.proxy.query' is not found" and pay-activity.service.js's
// onReceive never fires. Confirmed by inspecting the failed Bull job's stacktrace during the
// e2e test.
module.exports = ProxyService;
