import axios from 'axios';

const GAS_URL = "https://script.google.com/macros/s/AKfycbw_dGg3V4AxqK_8L9ko5ldahYmfSxD7xyItGO62AHMB8zrSS0A99A8cSMTGees3p-ie2A/exec";

const AXIOS_TIMEOUT = 15000;
const LONG_RUNNING_TIMEOUT = 120000;

const axiosInstance = axios.create({
  timeout: AXIOS_TIMEOUT,
});

const axiosLongRunningInstance = axios.create({
  timeout: LONG_RUNNING_TIMEOUT,
});

const cache = new Map();
const inFlight = new Map();

const CACHE_TTL = 120000;

const classifyError = (err, path) => {
  if (!err) {
    return {
      type: 'UNKNOWN',
      message: `Unknown error for ${path}`,
      retryable: false,
    };
  }

  if (
    err?.code === 'ECONNABORTED' ||
    err?.message?.toLowerCase().includes('timeout')
  ) {
    return {
      type: 'TIMEOUT',
      message: `Request timeout untuk ${path}. Proses mungkin masih berjalan di backend.`,
      retryable: true,
    };
  }

  if (
    err?.code === 'ERR_NETWORK' ||
    err?.message?.toLowerCase().includes('network error')
  ) {
    return {
      type: 'NETWORK_ERROR',
      message: `Gagal terhubung ke server (${path})`,
      retryable: true,
    };
  }

  if (err?.response?.status >= 500) {
    return {
      type: 'SERVER_ERROR',
      message: `Server error untuk ${path}`,
      retryable: true,
    };
  }

  if (err?.response?.status === 404) {
    return {
      type: 'NOT_FOUND',
      message: `Endpoint tidak ditemukan (${path})`,
      retryable: false,
    };
  }

  if (err?.response?.status === 403 || err?.response?.status === 401) {
    return {
      type: 'AUTH_ERROR',
      message: `Unauthorized untuk ${path}`,
      retryable: false,
    };
  }

  return {
    type: 'APPLICATION_ERROR',
    message: err?.message || `Gagal request ${path}`,
    retryable: false,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async (
  fn,
  path,
  maxRetries = 1,
  baseDelay = 1000
) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      if (attempt > 0) {
        console.log('[API RETRY SUCCESS]', {
          path,
          attempt,
        });
      }

      return result;
    } catch (err) {
      lastError = err;

      const errorInfo = classifyError(err, path);

      console.warn('[API REQUEST FAILED]', {
        path,
        attempt,
        ...errorInfo,
      });

      if (!errorInfo.retryable || attempt === maxRetries) {
        throw err;
      }

      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error(`Gagal request ${path}`);
};

export const postToGas = async (
  path,
  payload = {},
  options = {}
) => {
  const maxRetries = options.maxRetries ?? 1;

  return withRetry(
    async () => {
      const res = await axiosInstance.post(
        `${GAS_URL}?path=${path}`,
        JSON.stringify(payload),
        {
          headers: {
            'Content-Type': 'text/plain',
          },
        }
      );

      return res.data;
    },
    path,
    maxRetries
  );
};

export const postToGasLongRunning = async (
  path,
  payload = {},
  options = {}
) => {
  const maxRetries = options.maxRetries ?? 1;

  return withRetry(
    async () => {
      const res = await axiosLongRunningInstance.post(
        `${GAS_URL}?path=${path}`,
        JSON.stringify(payload),
        {
          headers: {
            'Content-Type': 'text/plain',
          },
        }
      );

      return res.data;
    },
    path,
    maxRetries
  );
};

export const getFromGas = async (
  path,
  skipCache = false,
  params = {},
  options = {}
) => {
  const maxRetries = options.maxRetries ?? 1;
  const cacheKey = JSON.stringify({
    path,
    params,
  });

  // =========================================================
  // 1. CEK CACHE
  // =========================================================
  if (!skipCache) {
    const cached = cache.get(cacheKey);

    if (cached) {
      const age = Date.now() - cached.time;

      if (age < CACHE_TTL) {
        return cached.data;
      }

      cache.delete(cacheKey);
    }
  }

  // =========================================================
  // 2. CEK REQUEST YANG MASIH BERJALAN
  // =========================================================
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  // =========================================================
  // 3. BUAT REQUEST BARU
  // =========================================================
  const requestPromise = withRetry(
    async () => {
      const query = new URLSearchParams({
        path,
        _t: String(Date.now()),
        ...params,
      });

      const res = await axiosInstance.get(
        `${GAS_URL}?${query.toString()}`
      );

      return res.data;
    },
    path,
    maxRetries
  )
    .then((data) => {
      // Jangan pernah menyimpan hasil error ke cache
      if (
        data?.status === 'timeout' ||
        data?.status === 'error'
      ) {
        throw new Error(
          data?.message || `Gagal request ${path}`
        );
      }

      // Hanya response sukses yang boleh masuk cache
      cache.set(cacheKey, {
        data,
        time: Date.now(),
      });

      return data;
    })
    .finally(() => {
      // Request selesai, hapus dari daftar in-flight
      inFlight.delete(cacheKey);
    });

  // Simpan promise agar request yang sama tidak dibuat berkali-kali
  inFlight.set(cacheKey, requestPromise);

  return requestPromise;
};

// =========================================================
// Profile / Bio
// =========================================================

export const updateBio = (payload) =>
  postToGas('updateBio', payload);

export const uploadProfilePhoto = (payload) =>
  postToGas('uploadProfilePhoto', payload);

// =========================================================
// Admin
// =========================================================

export const updatePoints = (payload) =>
  postToGas('updatePoints', payload);

// =========================================================
// Challonge
// =========================================================

export const getOpenMatches = (
  tournamentUrl,
  forceRefresh = false
) => {
  const path =
    `getOpenMatches&tournament_url=${encodeURIComponent(
      tournamentUrl
    )}`;

  if (forceRefresh) {
    cache.delete(path);
  }

  const cached = cache.get(path);

  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return {
      data: cached.data,
      raw: null,
    };
  }

  return axiosInstance
    .get(`${GAS_URL}?path=${path}&_t=${Date.now()}`)
    .then((res) => {
      cache.set(path, {
        data: res.data,
        time: Date.now(),
      });

      return {
        data: res.data,
        raw: res,
      };
    })
    .catch((err) => {
      console.warn(
        `GAS ${path} request failed:`,
        err?.message || err
      );

      return {
        data: null,
        raw: null,
      };
    });
};

export const submitMatchScore = (payload) =>
  postToGas('submitMatchScore', payload);

export const startTournament = (payload) =>
  postToGas('startTournament', payload);

export const randomizeParticipants = (payload) =>
  postToGas('randomizeParticipants', payload);

export const createTournament = (
  eventId,
  format,
  swissRounds
) =>
  postToGas('createTournament', {
    eventId,
    format,
    ...(swissRounds != null
      ? { swiss_rounds: swissRounds }
      : {}),
  });

export const updateSwissRounds = (payload) =>
  postToGas('updateSwissRounds', payload);

export const getActiveEvent = () =>
  getFromGas('getActiveEvent');

export const getEvents = () =>
  getFromGas('getEvents');

export const getBladers = () =>
  getFromGas('getBladers');

export const migratePublicProfileIds = () =>
  postToGas('migratePublicProfileIds', {});

export const getBladerProfile = (profileId) =>
  postToGas('getBladerProfile', {
    profileId,
  });

export const startEvent = (eventId) =>
  postToGas('startEvent', {
    eventId,
  });

export const endEvent = (eventId) =>
  postToGas('endEvent', {
    eventId,
  });

export const startTournamentStatus = (eventId) =>
  postToGas('startTournamentStatus', {
    eventId,
  });

export const finishTournamentStatus = (eventId) =>
  postToGas('finishTournamentStatus', {
    eventId,
  });

export const finishTournament = (eventId) =>
  postToGas('finishTournament', {
    eventId,
  });

export const updateEvent = (payload) =>
  postToGas('updateEvent', payload);

export const manualSync = (payload) =>
  postToGas('manualSync', payload);

export const rolloverLeaderboard = () =>
  postToGas('rolloverLeaderboard');

export const repairLeaderboardAfterFirstSync = () =>
  postToGas('repairLeaderboardAfterFirstSync');

export const repairExcludedLeaderboardPlayer = (payload) =>
  postToGas(
    'repairExcludedLeaderboardPlayer',
    payload
  );

export const checkTournamentSyncStatus = (eventId) =>
  getFromGas(
    'checkTournamentSyncStatus',
    false,
    { eventId }
  );

export const applyTournamentResultsToLeaderboard = (
  payload
) =>
  postToGasLongRunning(
    'applyTournamentResultsToLeaderboard',
    payload
  );

export const previewTournamentResultsToLeaderboard = (
  payload
) =>
  postToGas(
    'previewTournamentResultsToLeaderboard',
    payload
  );

export const repairTournamentParticipantMapping = (
  payload
) =>
  postToGas(
    'repairTournamentParticipantMapping',
    payload
  );

export const findTournamentResultSheet = (eventId) =>
  getFromGas(
    'findTournamentResultSheet',
    false,
    { eventId }
  );

// =========================================================
// Rule of the Month
// =========================================================

export const getRule = () =>
  getFromGas('getRule');

export const saveRule = (payload) =>
  postToGas('saveRule', payload);

// =========================================================
// Rules
// =========================================================

export const getRules = () =>
  getFromGas('getRules');

export const getRuleById = (ruleId) =>
  getFromGas(
    'getRuleById',
    false,
    { ruleId }
  );

export const createRule = (payload) =>
  postToGas('saveRule', payload);

// =========================================================
// Beyblade Parts & Decks
// =========================================================

export const getBeybladeParts = () =>
  postToGas('getBeybladeParts');

export const getMyDecks = (params = {}) =>
  postToGas('getMyDecks', params);

export const getActiveDecksByGoogleId = (googleId) =>
  getFromGas(
    'getActiveDecksByGoogleId',
    false,
    { googleId },
    { maxRetries: 1 }
  );

export const createBeybladePart = (payload) =>
  postToGas('createBeybladePart', payload);

export const toggleBeybladePart = (payload) =>
  postToGas('toggleBeybladePart', payload);

export const createDeck = (payload) =>
  postToGas('createDeck', payload);

export const updateDeck = (payload) =>
  postToGas('updateDeck', payload);

export const toggleDeckActive = (payload) =>
  postToGas('toggleDeckActive', payload);

export const deleteDeck = (payload) =>
  postToGas('deleteDeck', payload);

export const migrateLegacyDeckPartIds = () =>
  postToGas('migrateLegacyDeckPartIds');

export const fixLegacyDeckRow = (deckId) =>
  postToGas('fixLegacyDeckRow', {
    deckId,
  });
