import api from './axios';

export const auditService = {
  getLogs: async (page = 1, action?: string) => {
    const { data } = await api.get('/admin/audit-logs', { params: { page, action } });
    return data;
  }
};