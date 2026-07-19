import axios from 'axios';

const GAS_URL = "https://script.google.com/macros/s/AKfycbyzEQroC3szFDkuZXpLKykv4JGKIen4JmeqyLtnbnx0hrOdlF1P-Ay-M9okIfssVkflqA/exec";

const cache = new Map();
const CACHE_TTL = 120000;

export const postToGas = async (path, payload = {}) => {
  try {
    const res = await axios.post(`${GAS_URL}?path=${path}`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'text/plain' },
    });
    return res.data;
  } catch (err) {
    console.warn(`GAS ${path} request failed:`, err?.message || err);
    return { status: 'error', message: `Gagal terhubung ke server (${path})` };
  }
};

export const getFromGas = async (path) => {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  try {
    const res = await axios.get(`${GAS_URL}?path=${path}&_t=${Date.now()}`);
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
export const getOpenMatches = (tournamentUrl) => {
  const path = `getOpenMatches&tournament_url=${encodeURIComponent(tournamentUrl)}`;
  const cached = cache.get(path);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return { data: cached.data, raw: null };
  }
  return axios.get(`${GAS_URL}?path=${path}&_t=${Date.now()}`).then(res => {
    cache.set(path, { data: res.data, time: Date.now() });
    return { data: res.data, raw: res };
  }).catch(err => {
    console.warn(`GAS ${path} request failed:`, err?.message || err);
    return { data: null, raw: null };
  });
};
export const submitMatchScore = (payload) => postToGas('submitMatchScore', payload);
export const startTournament = (payload) => postToGas('startTournament', payload);
export const createTournament = (eventId, format) => postToGas('createTournament', { eventId, format });
export const updateSwissRounds = (payload) => postToGas('updateSwissRounds', payload);
export const getActiveEvent = () => getFromGas('getActiveEvent');
