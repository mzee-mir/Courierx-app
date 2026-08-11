import api from './axios';

export const staffService = {
  getStaff: async () => {
    const { data } = await api.get('/admin/staff');
    return data.staff;
  },
  createStaff: async (payload: any) => {
    const { data } = await api.post('/admin/staff', payload);
    return data;
  },
  
updateStaff: async (id: string, payload: any) => {
  const { data } = await api.patch(`/admin/staff/${id}`, payload);
  return data;
},
deleteStaff: async (id: string) => {
  const { data } = await api.delete(`/admin/staff/${id}`);
  return data;
},
getStaffDetail: async (id: string) => {
  const { data } = await api.get(`/admin/staff/${id}`);
  return data.data;
},
};