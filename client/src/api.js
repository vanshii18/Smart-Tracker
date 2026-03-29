import axios from 'axios';

function resolveBaseURL() {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    // 127.0.0.1 avoids some Windows localhost → IPv6 issues
    return 'http://127.0.0.1:5000';
  }
  return '';
}

export const api = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 15000,
});
