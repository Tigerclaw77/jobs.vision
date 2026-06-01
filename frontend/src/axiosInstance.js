// frontend/src/utils/api.js
import axios from "axios";
import { getNeonAccessToken, neonAuth } from "./utils/neonAuthClient";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || "/api",
});

// Attach latest Neon Auth access token to every request
api.interceptors.request.use(async (config) => {
  const token = await getNeonAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the backend says 401, sign out locally (optional)
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err?.response?.status === 401) {
      try { await neonAuth.signOut(); } catch {}
    }
    return Promise.reject(err);
  }
);

export default api;
