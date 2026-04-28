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

function isCollectionNotExistsError(error) {
  const text = [
    error && error.errMsg,
    error && error.message,
    error && error.errCode,
    error && error.code
  ]
    .filter(value => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('not exist') ||
    text.includes('not exists') ||
    text.includes('collection_not_exist') ||
    text.includes('database_collection_not_exist') ||
    text.includes('不存在')
  );
}

async function readCurrentUser(userRef) {
  try {
    return await userRef.get();
  } catch (error) {
    if (isCollectionNotExistsError(error)) {
      return { data: null, missingCollection: true };
    }

    return { data: null };
  }
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const stamp = nowIso(deps.now);
  let userRef = db.collection(COLLECTIONS.USERS).doc(openid);
  let current = await readCurrentUser(userRef);

  if (current.missingCollection) {
    await ensureCollectionsOnce(db, deps);
    userRef = db.collection(COLLECTIONS.USERS).doc(openid);
    current = await readCurrentUser(userRef);
  }

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
