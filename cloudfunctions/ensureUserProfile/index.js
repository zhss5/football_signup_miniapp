const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('./_shared/collections');
const { nowIso } = require('./_shared/time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  const openid = context.OPENID;
  const stamp = nowIso(deps.now);
  const userRef = db.collection(COLLECTIONS.USERS).doc(openid);
  const current = await userRef.get().catch(() => ({ data: null }));

  if (current.data) {
    await userRef.update({ data: { lastActiveAt: stamp } });
    return { user: { ...current.data, lastActiveAt: stamp } };
  }

  const user = {
    _id: openid,
    preferredName: '',
    avatarUrl: '',
    roles: ['user'],
    createdAt: stamp,
    lastActiveAt: stamp
  };

  await userRef.set({ data: user });
  return { user };
}

module.exports = { main };
