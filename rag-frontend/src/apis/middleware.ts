import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { PATHS } from "@/constants/paths";
import { ENV } from "@/constants/environments";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: ENV.BASE_API_URL,
  withCredentials: true,
});

/* ============================
   REQUEST INTERCEPTOR
============================ */
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof globalThis.window !== "undefined") {
      const token = localStorage.getItem("access_token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* ============================
   RESPONSE INTERCEPTOR
============================ */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      typeof globalThis.window !== "undefined" &&
      error.response?.status === 401
    ) {
      // 🔐 Token invalid / expired
      localStorage.removeItem("access_token");

      // redirect to login
      globalThis.window.location.href = PATHS.pl.LOGIN;
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
