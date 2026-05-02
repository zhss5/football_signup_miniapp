const {
  USE_LOCAL_MOCK,
  LOCAL_STORAGE_KEY,
  CLOUD_ENV_ID,
  ENABLE_CLOUD_DIAGNOSTICS
} = require('../config/env');
const { buildStorageAdapter, createLocalCloudClient } = require('../mocks/local-cloud');

let localCloudClient = null;
let cloudRuntime = null;

function getWxRuntime() {
  if (typeof wx !== 'undefined' && wx) {
    return wx;
  }

  if (typeof globalThis !== 'undefined' && globalThis.wx) {
    return globalThis.wx;
  }

  return null;
}

function getLocalCloudClient() {
  if (!localCloudClient) {
    localCloudClient = createLocalCloudClient({
      storage: buildStorageAdapter(LOCAL_STORAGE_KEY),
      storageKey: LOCAL_STORAGE_KEY
    });
  }

  return localCloudClient;
}

function getNowMs() {
  if (
    typeof performance !== 'undefined' &&
    performance &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }

  return Date.now();
}

function summarizeError(error) {
  if (!error) {
    return {};
  }

  return {
    message: error.message,
    errMsg: error.errMsg,
    errCode: error.errCode,
    code: error.code
  };
}

function formatErrorText(error) {
  if (!error) {
    return '';
  }

  return error.message || error.errMsg || String(error);
}

function logCloudDiagnostic(event, details) {
  if (!ENABLE_CLOUD_DIAGNOSTICS || typeof console === 'undefined' || !console.info) {
    return;
  }

  console.info(`[cloud] ${event}`, details || {});
}

function initializeCloudRuntime() {
  if (USE_LOCAL_MOCK) {
    return {
      mode: 'local-mock'
    };
  }

  if (!CLOUD_ENV_ID) {
    throw new Error('CLOUD_ENV_ID is required when USE_LOCAL_MOCK is false');
  }

  const wxRuntime = getWxRuntime();

  if (!wxRuntime || !wxRuntime.cloud) {
    throw new Error('Cloud capability is required');
  }

  if (!cloudRuntime) {
    logCloudDiagnostic('init:start', { envId: CLOUD_ENV_ID });

    try {
      wxRuntime.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      });
    } catch (error) {
      logCloudDiagnostic('init:failure', {
        envId: CLOUD_ENV_ID,
        error: summarizeError(error)
      });
      throw error;
    }

    logCloudDiagnostic('init:success', { envId: CLOUD_ENV_ID });

    cloudRuntime = {
      mode: 'cloudbase',
      envId: CLOUD_ENV_ID
    };
  }

  return cloudRuntime;
}

function call(name, data = {}) {
  if (USE_LOCAL_MOCK) {
    return getLocalCloudClient().call(name, data);
  }

  initializeCloudRuntime();

  const wxRuntime = getWxRuntime();
  const startedAt = getNowMs();
  logCloudDiagnostic('call:start', { name });

  try {
    return wxRuntime.cloud.callFunction({
      name,
      data
    }).then(
      res => {
        logCloudDiagnostic('call:success', {
          name,
          elapsedMs: Math.round(getNowMs() - startedAt)
        });
        return res.result;
      },
      error => {
        logCloudDiagnostic('call:failure', {
          name,
          elapsedMs: Math.round(getNowMs() - startedAt),
          errorText: formatErrorText(error),
          error: summarizeError(error)
        });
        throw error;
      }
    );
  } catch (error) {
    logCloudDiagnostic('call:failure', {
      name,
      elapsedMs: Math.round(getNowMs() - startedAt),
      errorText: formatErrorText(error),
      error: summarizeError(error)
    });
    throw error;
  }
}

function uploadFile(filePath, cloudPath) {
  if (!filePath || filePath.startsWith('cloud://') || USE_LOCAL_MOCK) {
    return Promise.resolve(filePath || '');
  }

  initializeCloudRuntime();

  const wxRuntime = getWxRuntime();

  return wxRuntime.cloud
    .uploadFile({
      cloudPath,
      filePath
    })
    .then(res => res.fileID);
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

function downloadFile(fileID) {
  if (!fileID || !isCloudFileId(fileID) || USE_LOCAL_MOCK) {
    return Promise.resolve(fileID || '');
  }

  initializeCloudRuntime();

  const wxRuntime = getWxRuntime();

  if (!wxRuntime || !wxRuntime.cloud || typeof wxRuntime.cloud.downloadFile !== 'function') {
    return Promise.resolve('');
  }

  return wxRuntime.cloud.downloadFile({ fileID }).then(res => (res && res.tempFilePath) || '');
}

function buildIdentityFileUrlMap(fileIds) {
  return fileIds.reduce((acc, fileId) => {
    if (fileId) {
      acc[fileId] = fileId;
    }

    return acc;
  }, {});
}

function getUnresolvedCloudFileIds(cloudFileIds, urlByFileId) {
  return cloudFileIds.filter(fileId => {
    const resolvedUrl = urlByFileId[fileId];
    return !resolvedUrl || isCloudFileId(resolvedUrl);
  });
}

function logUnresolvedFileUrls(unresolvedFileIds) {
  if (unresolvedFileIds.length === 0) {
    return;
  }

  logCloudDiagnostic('file-url:unresolved', {
    unresolvedCount: unresolvedFileIds.length,
    fileIds: unresolvedFileIds
  });
}

function downloadFileUrls(wxRuntime, fileIds, urlByFileId) {
  if (
    fileIds.length === 0 ||
    !wxRuntime ||
    !wxRuntime.cloud ||
    typeof wxRuntime.cloud.downloadFile !== 'function'
  ) {
    logUnresolvedFileUrls(fileIds);
    return Promise.resolve(urlByFileId);
  }

  return Promise.all(
    fileIds.map(fileID =>
      wxRuntime.cloud
        .downloadFile({
          fileID
        })
        .then(res => {
          if (res && res.tempFilePath) {
            urlByFileId[fileID] = res.tempFilePath;
          }
        })
        .catch(error => {
          logCloudDiagnostic('file-url:download-failure', {
            fileID,
            errorText: formatErrorText(error),
            error: summarizeError(error)
          });
        })
    )
  ).then(() => {
    logUnresolvedFileUrls(getUnresolvedCloudFileIds(fileIds, urlByFileId));
    return urlByFileId;
  });
}

async function resolveFileUrls(fileIds = []) {
  const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)));
  const urlByFileId = buildIdentityFileUrlMap(uniqueFileIds);
  const cloudFileIds = uniqueFileIds.filter(isCloudFileId);

  if (USE_LOCAL_MOCK || cloudFileIds.length === 0) {
    return urlByFileId;
  }

  initializeCloudRuntime();

  const wxRuntime = getWxRuntime();

  if (
    !wxRuntime ||
    !wxRuntime.cloud ||
    typeof wxRuntime.cloud.getTempFileURL !== 'function'
  ) {
    return downloadFileUrls(wxRuntime, cloudFileIds, urlByFileId);
  }

  try {
    const res = await wxRuntime.cloud.getTempFileURL({
      fileList: cloudFileIds
    });

    (res.fileList || []).forEach((file = {}, index) => {
      const requestedFileId = cloudFileIds[index];
      const responseFileId = file.fileID;
      const mapFileId =
        responseFileId && Object.prototype.hasOwnProperty.call(urlByFileId, responseFileId)
          ? responseFileId
          : requestedFileId;

      if (mapFileId && file.tempFileURL) {
        urlByFileId[mapFileId] = file.tempFileURL;
        if (responseFileId) {
          urlByFileId[responseFileId] = file.tempFileURL;
        }
      } else if (mapFileId) {
        logCloudDiagnostic('file-url:temp-url-missing', {
          fileID: mapFileId,
          responseFileID: responseFileId,
          status: file.status,
          errMsg: file.errMsg
        });
      }
    });

    return downloadFileUrls(
      wxRuntime,
      getUnresolvedCloudFileIds(cloudFileIds, urlByFileId),
      urlByFileId
    );
  } catch (error) {
    logCloudDiagnostic('file-url:failure', {
      errorText: formatErrorText(error),
      error: summarizeError(error)
    });
    return downloadFileUrls(wxRuntime, cloudFileIds, urlByFileId);
  }
}

module.exports = {
  call,
  downloadFile,
  initializeCloudRuntime,
  resolveFileUrls,
  uploadFile
};
