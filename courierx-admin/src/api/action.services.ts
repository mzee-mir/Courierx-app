import api from './axios';

export const actionService = {
  /**
   * List all actions waiting for a second signature
   */
  getPending: async () => {
    const { data } = await api.get('/admin/actions/pending');
    return data.actions;
  },

  /**
   * Approve a proposal (Must be a different Super Admin)
   */
  approve: async (actionId: string) => {
    const { data } = await api.post(`/admin/actions/${actionId}/approve`);
    return data;
  },

  /**
   * Reject a proposal
   */
  reject: async (actionId: string, reason: string) => {
    const { data } = await api.post(`/admin/actions/${actionId}/reject`, { reason });
    return data;
  }
};