const { COLLECTIONS } = require('./collections');

function isCollectionAlreadyExistsError(error) {
  const text = [
    error && error.errMsg,
    error && error.message,
    error && error.errCode,
    error && error.code
  ]
    .filter(value => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase();

  if (text.includes('not exist') || text.includes('not exists') || text.includes('不存在')) {
    return false;
  }

  return (
    text.includes('already exist') ||
    text.includes('already exists') ||
    text.includes('resourceexist') ||
    text.includes('resource exist') ||
    text.includes('table exist') ||
    text.includes('is exist') ||
    text.includes('is existed') ||
    text.includes('has exist') ||
    text.includes('has existed') ||
    text.includes('已存在') ||
    text.includes('已经存在')
  );
}

async function ensureCloudCollections(db, collectionNames = Object.values(COLLECTIONS)) {
  const summary = {
    created: [],
    existing: [],
    skipped: []
  };

  if (!db || typeof db.createCollection !== 'function') {
    summary.skipped = collectionNames.slice();
    return summary;
  }

  for (const name of collectionNames) {
    try {
      await db.createCollection(name);
      summary.created.push(name);
    } catch (error) {
      if (isCollectionAlreadyExistsError(error)) {
        summary.existing.push(name);
        continue;
      }

      throw error;
    }
  }

  return summary;
}

module.exports = {
  ensureCloudCollections,
  isCollectionAlreadyExistsError
};
