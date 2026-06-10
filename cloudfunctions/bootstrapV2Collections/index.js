const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('./collections');
const { ensureCloudCollections } = require('./database');
const { businessError } = require('./errors');
const { isSuperAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const CONFIRMATION = 'bootstrap-v2-collections';
const V2_BOOTSTRAP_COLLECTIONS = [
  COLLECTIONS.ACTIVITY_LOGS,
  COLLECTIONS.USER_ROLE_LOGS,
  COLLECTIONS.NOTIFICATION_LOGS,
  COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS
];

function resolveOptionalOpenId(context, getWXContext) {
  if (context && context.OPENID) {
    return context.OPENID;
  }

  if (typeof getWXContext !== 'function') {
    return '';
  }

  try {
    const wxContext = getWXContext() || {};
    return wxContext.OPENID || '';
  } catch (error) {
    return '';
  }
}

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

async function assertBootstrapAllowed(db, openid) {
  if (!openid) {
    return;
  }

  const caller = await loadUser(db, openid);
  if (!isSuperAdmin(caller)) {
    throw businessError('Only super admins can bootstrap V2 collections');
  }
}

function normalizeSummary(summary) {
  return {
    created: Array.isArray(summary && summary.created) ? summary.created : [],
    existing: Array.isArray(summary && summary.existing) ? summary.existing : [],
    skipped: Array.isArray(summary && summary.skipped) ? summary.skipped : []
  };
}

async function main(event, context = {}, deps = {}) {
  const payload = event || {};
  if (payload.confirm !== CONFIRMATION) {
    throw businessError(`confirm must be ${CONFIRMATION}`);
  }

  const db = deps.db || cloud.database();
  const openid = resolveOptionalOpenId(context, deps.getWXContext);
  await assertBootstrapAllowed(db, openid);

  const ensureCollections = deps.ensureCloudCollections || ensureCloudCollections;
  const summary = await ensureCollections(db, V2_BOOTSTRAP_COLLECTIONS);

  return {
    ok: true,
    collections: normalizeSummary(summary)
  };
}

module.exports = {
  CONFIRMATION,
  V2_BOOTSTRAP_COLLECTIONS,
  main
};
