import axios from "axios";

const api = axios.create({
  baseURL:'https://tech-explainer-reels.onrender.com/api',
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ter_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) delete config.headers["Content-Type"]; // browser sets the multipart boundary
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
