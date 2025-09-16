// frontend/src/utils/api.js
import axios from "axios";
import { supabase } from "./supabaseClient";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || "/api",
});

// Attach latest Supabase access token to every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the backend says 401, sign out locally (optional)
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err?.response?.status === 401) {
      try { await supabase.auth.signOut(); } catch {}
    }
    return Promise.reject(err);
  }
);

export default api;
