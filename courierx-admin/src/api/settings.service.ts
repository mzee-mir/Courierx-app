import api from './axios';

export const settingsService = {
  broadcast: async (data: { targetRole: string; title: string; body: string }) => {
    const res = await api.post('/admin/broadcast', data);
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get('/admin/settings');
    return res.data.settings;
  },
  getSchema: async () => {
    const { data } = await api.get('/admin/settings/schema');
    return data.schema; // Returns { KEY: { isImplemented, description, ... } }
  },

  updateSetting: async (key: string, value: any, reason: string) => {
    const { data } = await api.patch(`/admin/settings/${key}`, { value, reason });
    return data;
  },
  createBroadcastDraft: async (payload: { targetRole: string; title: string; body: string }) => {
    const { data } = await api.post('/admin/broadcast/draft', payload);
    return data; // Returns { draftId: string, impactCount: number }
  },

  executeBroadcast: async (draftId: string) => {
    const { data } = await api.post(`/admin/broadcast/${draftId}/execute`);
    return data;
  },

  abortBroadcast: async (broadcastId: string) => {
    const { data } = await api.post(`/admin/broadcast/${broadcastId}/abort`);
    return data;
  },

  getQueuedBroadcasts: async () => {
    const { data } = await api.get('/admin/broadcast/history');
    return data.broadcasts;
  }
};