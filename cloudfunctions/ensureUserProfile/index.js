const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { ensureCloudCollections } = require('./database');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

let collectionBootstrapPromise = null;

function ensureCollectionsOnce(db, deps) {
  if (deps.ensureCloudCollections) {
    return deps.ensureCloudCollections(db);
  }

  if (!db || typeof db.createCollection !== 'function') {
    return ensureCloudCollections(db);
  }

  if (!collectionBootstrapPromise) {
    collectionBootstrapPromise = ensureCloudCollections(db).catch(error => {
      collectionBootstrapPromise = null;
      throw error;
    });
  }

  return collectionBootstrapPromise;
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  await ensureCollectionsOnce(db, deps);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const stamp = nowIso(deps.now);
  const userRef = db.collection(COLLECTIONS.USERS).doc(openid);
  const current = await userRef.get().catch(() => ({ data: null }));

  if (current.data) {
    await userRef.update({ data: { lastActiveAt: stamp } });
    return { user: { ...current.data, lastActiveAt: stamp } };
  }

  const userData = {
    preferredName: '',
    avatarUrl: '',
    roles: ['user'],
    createdAt: stamp,
    lastActiveAt: stamp
  };

  await userRef.set({ data: userData });
  return {
    user: {
      _id: openid,
      ...userData
    }
  };
}

module.exports = { main };
