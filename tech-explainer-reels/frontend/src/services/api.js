
import axios from "axios";

export const BACKEND_URL =
  "https://tech-explainer-reels.onrender.com";

export const mediaUrl = (url) => {
  if (!url) return url;

  // Keep absolute URLs unchanged.
  if (/^https?:\/\//i.test(url)) return url;

  // Point uploaded videos and images to Render, not Vercel.
  return `${BACKEND_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ter_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Let the browser set the multipart boundary for uploads.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("ter_token");
      localStorage.removeItem("ter_user");
    }

    return Promise.reject(error);
  }
);

export default api;
