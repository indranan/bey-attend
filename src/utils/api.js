import axios from 'axios';

const GAS_URL = "https://script.google.com/macros/s/AKfycbwTUt8yMgrrVYCpLZCpOKdYiEpsKN7WcLzcOigtoJqMsqIrIVeK57tyrTRvaPjRt47Gvw/exec";


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
  try {
    const res = await axios.get(`${GAS_URL}?path=${path}&_t=${Date.now()}`);
    return res.data;
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
