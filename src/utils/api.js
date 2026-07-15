import axios from 'axios';

const GAS_URL = "https://script.google.com/macros/s/AKfycbxK_7NZLUxM59QKdaJerar4DtF4drR4QXK2uLYM4cH8Nm_b_qdqpDY9WzGCUT8UZ7Bkcg/exec";


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
