export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }
  return res.json();
};

export const api = {
  fetchApi,
  getDashboard: () => fetchApi('/dashboard'),
  getServices: () => fetchApi('/services'),
  getOrders: () => fetchApi('/orders'),
  getWallet: () => fetchApi('/wallet'),
  getSupportTickets: () => fetchApi('/support/tickets'),
  createSupportTicket: (data: any) => fetchApi('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
  getSettings: () => fetchApi('/settings'),
  updateSettings: (data: any) => fetchApi('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};
