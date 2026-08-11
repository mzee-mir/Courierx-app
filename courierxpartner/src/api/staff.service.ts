import api from './axios';


export const staffService = {
  // --- OWNER TOOLS ---
  getOrgStaff: async () => {
    const { data } = await api.get('/partner/staff');
    return data.staff;
  },


  createWorker: async (payload: any) => {
    const { data } = await api.post('/partner/staff', payload);
    return data;
  },


  toggleWorkerStatus: async (id: string, isSuspended: boolean) => {
    const { data } = await api.patch(`/partner/staff/${id}/status`, { isSuspended });
    return data;
  },


  getLoginHistory: async (staffId: string) => {
    const { data } = await api.get(`/partner/staff/${staffId}/history`);
    return data.history;
  },


  getOrgAuditTrail: async (filters: { search?: string; start?: string; end?: string }) => {
    const { data } = await api.get('/partner/audit-trail', { params: filters });
    return data.logs;
  },


  updatePermissions: async (id: string, permissions: string[]) => {
    const { data } = await api.patch(`/partner/staff/${id}/permissions`, { permissions });
    return data;
  },
  updateSelfProfile: async (payload: any) => {
    const { data } = await api.patch('/partner/profile/self', payload);
    return data;
  },
};