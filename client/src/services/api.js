import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// DB Connections
export const dbAPI = {
  getConnections: () => api.get('/db/connections'),
  addConnection: (data) => api.post('/db/connect', data),
  testConnection: (data) => api.post('/db/test', data),
  deleteConnection: (id) => api.delete(`/db/connections/${id}`),
  getSchema: (connectionId) => api.get(`/db/schema/${connectionId}`),
};

// Query
export const queryAPI = {
  generate: (data) => api.post('/query/generate', data),
  run: (data) => api.post('/query/run', data),
  save: (data) => api.post('/query/save', data),
  getHistory: (params) => api.get('/query/history', { params }),
  updateQuery: (id, data) => api.put(`/query/history/${id}`, data),
  deleteQuery: (id) => api.delete(`/query/history/${id}`),
};

export default api;
