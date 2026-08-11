import api from './axios';

export const orderService = {
  getActive: async () => {
    const { data } = await api.get('/admin/orders/active');
    return data.orders;
  },
  unassign: async (orderId: string) => {
    const { data } = await api.post(`/admin/orders/${orderId}/unassign`);
    return data;
  },
  cancel: async (orderId: string, reason: string) => {
    const { data } = await api.post(`/admin/orders/${orderId}/cancel`, { reason });
    return data;
  },
  getHistory: async (params: any) => {
  const { data } = await api.get('/admin/orders/history', { params });
  return data;
}
};