/**
 * Human Legacy AI - Central API Client
 *
 * All requests enforce `credentials: 'include'` to automatically transmit
 * the secure httpOnly authentication cookie between frontend and backend.
 */

const BASE_URL = '';

async function request(endpoint, options = {}) {
  const defaultHeaders = {};

  // Only set Content-Type to JSON if not uploading FormData (multipart)
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Strictly required for httpOnly cookie auth
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 204) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication
  auth: {
    register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    getMe: () => request('/api/auth/me', { method: 'GET' }),
  },

  // Memories
  memories: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.search) query.append('search', params.search);
      if (params.category) query.append('category', params.category);
      if (params.verification_status) query.append('verification_status', params.verification_status);
      if (params.page) query.append('page', params.page);
      if (params.page_size) query.append('page_size', params.page_size);
      const qStr = query.toString();
      return request(`/api/memories${qStr ? `?${qStr}` : ''}`, { method: 'GET' });
    },
    get: (id) => request(`/api/memories/${id}`, { method: 'GET' }),
    create: (payload) => request('/api/memories', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/api/memories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    delete: (id) => request(`/api/memories/${id}`, { method: 'DELETE' }),
  },

  // Uploads
  uploads: {
    uploadFile: (formData) => request('/api/uploads', { method: 'POST', body: formData }),
    getStatus: (jobId) => request(`/api/uploads/${jobId}`, { method: 'GET' }),
    retry: (jobId) => request(`/api/uploads/${jobId}/retry`, { method: 'POST' }),
  },

  // Chat & RAG
  chat: {
    send: (payload) => request('/api/chat', { method: 'POST', body: JSON.stringify(payload) }),
    listConversations: () => request('/api/conversations', { method: 'GET' }),
    getConversation: (id) => request(`/api/conversations/${id}`, { method: 'GET' }),
    deleteConversation: (id) => request(`/api/conversations/${id}`, { method: 'DELETE' }),
  },

  // Voice Fallback
  voice: {
    transcribe: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request('/api/voice/transcribe', { method: 'POST', body: fd });
    },
    synthesize: (text, voice_name = 'Aoede') => {
      return request('/api/voice/synthesize', {
        method: 'POST',
        body: JSON.stringify({ text, voice_name }),
      });
    },
    query: ({ audio, text, conversation_id, voice_name = 'Aoede' }) => {
      const fd = new FormData();
      if (audio) fd.append('audio', audio);
      if (text) fd.append('text', text);
      if (conversation_id) fd.append('conversation_id', conversation_id);
      if (voice_name) fd.append('voice_name', voice_name);
      return request('/api/voice/query', { method: 'POST', body: fd });
    },
  },
};

