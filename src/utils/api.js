import axios from 'axios';

const GAS_URL = "https://script.google.com/macros/s/AKfycbwA2ei8vZCdSIjtxWV5bzaStfwDjdNSX7VmijIA_Q8h_X6aTkjoWCAo_RtP2uHC3iZGHw/exec";

const AXIOS_TIMEOUT = 15000;

const axiosInstance = axios.create({
  timeout: AXIOS_TIMEOUT,
});

const cache = new Map();
const CACHE_TTL = 120000;

export const postToGas = async (path, payload = {}) => {
  try {
    const res = await axiosInstance.post(`${GAS_URL}?path=${path}`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'text/plain' },
    });
    return res.data;
  } catch (err) {
    console.warn(`GAS ${path} request failed:`, err?.message || err);
    return { status: 'error', message: `Gagal terhubung ke server (${path})` };
  }
};

export const getFromGas = async (path, skipCache = false) => {
  if (!skipCache) {
    const cached = cache.get(path);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return cached.data;
    }
  }
  try {
    const res = await axiosInstance.get(`${GAS_URL}?path=${path}&_t=${Date.now()}`);
    const data = res.data;
    cache.set(path, { data, time: Date.now() });
    return data;
  } catch (err) {
    console.warn(`GAS ${path} request failed:`, err?.message || err);
    return null;
  }
};

// --- Profile / Bio ---
export const updateBio = (payload) => postToGas('updateBio', payload);
export const uploadProfilePhoto = (payload) => postToGas('uploadProfilePhoto', payload);

// --- Admin ---
export const updatePoints = (payload) => postToGas('updatePoints', payload);

// --- Challonge ---
export const getOpenMatches = (tournamentUrl, forceRefresh = false) => {
  const path = `getOpenMatches&tournament_url=${encodeURIComponent(tournamentUrl)}`;
  if (forceRefresh) {
    cache.delete(path);
  }
  const cached = cache.get(path);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return { data: cached.data, raw: null };
  }
  return axiosInstance.get(`${GAS_URL}?path=${path}&_t=${Date.now()}`).then(res => {
    cache.set(path, { data: res.data, time: Date.now() });
    return { data: res.data, raw: res };
  }).catch(err => {
    console.warn(`GAS ${path} request failed:`, err?.message || err);
    return { data: null, raw: null };
  });
};
export const submitMatchScore = (payload) => postToGas('submitMatchScore', payload);
export const startTournament = (payload) => postToGas('startTournament', payload);
export const randomizeParticipants = (payload) => postToGas('randomizeParticipants', payload);
export const createTournament = (eventId, format, swissRounds) => postToGas('createTournament', {
  eventId,
  format,
  ...(swissRounds != null ? { swiss_rounds: swissRounds } : {})
});
export const updateSwissRounds = (payload) => postToGas('updateSwissRounds', payload);
export const getActiveEvent = () => getFromGas('getActiveEvent');
export const manualSync = (payload) => postToGas('manualSync', payload);

// --- Rule of the Month ---
export const getRule = () => getFromGas('getRule');
export const saveRule = (payload) => postToGas('saveRule', payload);
