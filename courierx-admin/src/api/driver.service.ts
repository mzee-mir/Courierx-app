import api from './axios';

export const driverService = {
  getPending: async () => {
    const { data } = await api.get('/admin/drivers/pending');
    return data.drivers;
  },
  verify: async (id: string, status: 'approved' | 'rejected') => {
    const { data } = await api.patch(`/admin/drivers/${id}/verify`, { status });
    return data;
  },
  getFullDetail: async (id: string) => {
    const { data } = await api.get(`/admin/drivers/${id}/detail`);
    return data.data; // This returns the object containing { user, profile, wallet, stats }
  },
  getLeaderboard: async (params: any) => {
  const { data } = await api.get('/admin/drivers/leaderboard', { params });
  return data.data;
},
approveDriver: async (driverId: string, vehicleAssignment?: any) => {
    const { data } = await api.post('/drivers/approve', { driverId, vehicleAssignment });
    return data;
  },

  rejectDriver: async (driverId: string, reason: string) => {
    const { data } = await api.post('/drivers/reject', { driverId, reason });
    return data;
  },

  assignVehicle: async (id: string, vehicleType: string) => {
    const { data } = await api.post(`/drivers/${id}/assignVehicle`, { vehicleType });
    return data;
  }
};