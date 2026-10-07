import { authApi } from "./api";

// OAuth callback sessions are delivered as an HttpOnly cookie. Keep sending
// cookies on auth requests while the bearer-token path remains compatible.
authApi.defaults.withCredentials = true;

export const login = async (email, password, turnstileToken) => {
  const { data } = await authApi.post("/auth/login", { email, password, turnstileToken });
  return data;
};

export const loginWithGoogle = async (token, turnstileToken) => {
  const { data } = await authApi.post("/auth/google", { token, turnstileToken });
  return data;
};

export const register = async (username, email, password, turnstileToken) => {
  const { data } = await authApi.post("/auth/register", { username, email, password, turnstileToken });
  return data;
};

export const getMe = async () => {
  const { data } = await authApi.get("/auth/me");
  return data;
};

export const updateMe = async (profileData) => {
  const { data } = await authApi.put("/auth/me", profileData);
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await authApi.post("/auth/forgot-password", { email });
  return data;
};

export const resetPassword = async (token, password) => {
  const { data } = await authApi.post(`/auth/reset-password/${token}`, { password });
  return data;
};

export const getAnilistAuthUrl = async () => {
  const { data } = await authApi.post('/auth/anilist');
  return data.url;
};

export const disconnectAnilist = async () => {
  const { data } = await authApi.post("/auth/anilist/disconnect");
  return data;
};

export const syncAnilist = async () => {
  const { data } = await authApi.post("/auth/anilist/sync");
  return data;
};
