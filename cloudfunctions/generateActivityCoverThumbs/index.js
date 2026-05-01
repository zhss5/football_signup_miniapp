const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { getRoles } = require('./roles');
const { nowIso } = require('./time');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 240;
const THUMB_QUALITY = 68;

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizeLimit(value) {
  const limit = Number(value) || DEFAULT_LIMIT;
  return Math.max(1, Math.min(limit, MAX_LIMIT));
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

function getCloudPathFromFileId(fileId) {
  const match = String(fileId || '').match(/^cloud:\/\/[^/]+\/(.+)$/);
  return match ? match[1] : fileId;
}

function buildFileIdFromCloudPath(sourceFileId, outputCloudPath) {
  const match = String(sourceFileId || '').match(/^(cloud:\/\/[^/]+)\/.+$/);
  return match ? `${match[1]}/${outputCloudPath}` : outputCloudPath;
}

function sanitizePathPart(value) {
  return String(value || 'activity')
    .replace(/[^a-z0-9_-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'activity';
}

function buildThumbCloudPath(activity, nowMs) {
  const idPart = sanitizePathPart(activity._id);
  const suffix = Math.random().toString(36).slice(2, 10);
  return `activity-cover-thumbs/${idPart}-${nowMs}-${suffix}.jpg`;
}

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function assertAdmin(db, openid) {
  const user = await getCurrentUser(db, openid);

  if (!getRoles(user).includes('admin')) {
    throw businessError('Only admins can generate activity cover thumbnails');
  }
}

async function loadActivities(db, limit) {
  const collection = db.collection(COLLECTIONS.ACTIVITIES);

  if (typeof collection.limit === 'function') {
    const result = await collection.limit(limit).get();
    return result.data || [];
  }

  const result = await collection.get();
  return (result.data || []).slice(0, limit);
}

function shouldProcessActivity(activity, force) {
  if (!activity || !activity._id) {
    return false;
  }

  if (!isCloudFileId(activity.coverImage)) {
    return false;
  }

  return force || !activity.coverThumbImage;
}

function createThumbnailProcessor(deps = {}) {
  if (deps.thumbnailProcessor) {
    return deps.thumbnailProcessor;
  }

  const tcb = deps.tcb || require('@cloudbase/node-sdk');
  const extCi = deps.extCi || require('@cloudbase/extension-ci');
  const app = deps.app || tcb.init({ env: deps.env || tcb.SYMBOL_CURRENT_ENV });

  if (typeof app.registerExtension === 'function') {
    app.registerExtension(extCi);
  }

  return {
    async createThumbnail({ sourceFileId, outputCloudPath }) {
      await app.invokeExtension('CloudInfinite', {
        action: 'ImageProcess',
        cloudPath: getCloudPathFromFileId(sourceFileId),
        operations: {
          rules: [
            {
              fileid: `/${outputCloudPath}`,
              rule: `imageMogr2/thumbnail/${THUMB_WIDTH}x${THUMB_HEIGHT}!/quality/${THUMB_QUALITY}/format/jpg`
            }
          ]
        }
      });

      return buildFileIdFromCloudPath(sourceFileId, outputCloudPath);
    }
  };
}

async function main(event = {}, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const limit = normalizeLimit(event.limit);
  const dryRun = Boolean(event.dryRun);
  const force = Boolean(event.force);
  const stamp = nowIso(deps.now);
  const nowMs = deps.nowMs || Date.now();

  await assertAdmin(db, openid);

  const activities = await loadActivities(db, limit);
  const candidates = activities.filter(activity => shouldProcessActivity(activity, force));
  const items = candidates.map(activity => ({
    activityId: activity._id,
    sourceFileId: activity.coverImage,
    existingThumbFileId: activity.coverThumbImage || ''
  }));

  if (dryRun) {
    return {
      dryRun: true,
      scanned: activities.length,
      candidates: candidates.length,
      processed: 0,
      skipped: activities.length - candidates.length,
      failed: 0,
      items
    };
  }

  const thumbnailProcessor = createThumbnailProcessor(deps);
  const processedItems = [];
  const failedItems = [];

  for (const activity of candidates) {
    const outputCloudPath = buildThumbCloudPath(activity, nowMs);

    try {
      const coverThumbImage = await thumbnailProcessor.createThumbnail({
        activity,
        sourceFileId: activity.coverImage,
        outputCloudPath,
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        quality: THUMB_QUALITY
      });

      await db.collection(COLLECTIONS.ACTIVITIES).doc(activity._id).update({
        data: {
          coverThumbImage,
          coverThumbGeneratedAt: stamp
        }
      });

      processedItems.push({
        activityId: activity._id,
        sourceFileId: activity.coverImage,
        coverThumbImage
      });
    } catch (error) {
      failedItems.push({
        activityId: activity._id,
        sourceFileId: activity.coverImage,
        error: error && (error.message || error.errMsg) ? error.message || error.errMsg : String(error)
      });
    }
  }

  return {
    dryRun: false,
    scanned: activities.length,
    candidates: candidates.length,
    processed: processedItems.length,
    skipped: activities.length - candidates.length,
    failed: failedItems.length,
    items: processedItems,
    failures: failedItems
  };
}

module.exports = {
  main,
  _private: {
    buildFileIdFromCloudPath,
    getCloudPathFromFileId,
    shouldProcessActivity
  }
};
