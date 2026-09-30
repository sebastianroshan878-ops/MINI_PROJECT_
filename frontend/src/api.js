// One small helper that talks to the Express API. Every page uses api.get / api.post ...
const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    // empty or non-JSON reply
  }

  if (!res.ok) {
    const error = new Error((data && data.message) || 'Something went wrong. Please try again');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body || {} }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body || {} }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
