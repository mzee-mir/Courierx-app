import api from './axios';

export const importService = {
  // --- PARTNER ORGS ---
  getOrganizations: async () => {
    const { data } = await api.get('/admin/partners');
    return data.partners;
  },
  createOrganization: async (payload: any) => {
    const { data } = await api.post('/admin/partners', payload);
    return data;
  },

  // --- PHYSICAL NODES ---
  getLocations: async (partnerId?: string) => {
    const { data } = await api.get('/admin/locations', { params: { partnerId } });
    return data.locations;
  },
  createLocation: async (payload: any) => {
    const { data } = await api.post('/admin/locations', payload);
    return data;
  },

  // --- EXCEPTION MANAGEMENT ---
  getFlaggedShipments: async () => {
    const { data } = await api.get('/admin/imports/flagged');
    return data.shipments;
  },
  resolveException: async (id: string, action: 'PROCEED' | 'CANCEL', note: string) => {
    const { data } = await api.post(`/admin/imports/${id}/resolve`, { 
      action, 
      resolutionNote: note 
    });
    return data;
  },

  getActive: async () => {
    const { data } = await api.get('/admin/imports/active');
    return data.shipments;
  },

  bulkUpdateStatus: async (shipmentIds: string[], nextStatus: string, locationId: string) => {
    const { data } = await api.patch('/admin/imports/bulk-status', { 
      shipmentIds, 
      nextStatus, 
      locationId 
    });
    return data;
  },

  uploadManifest: async (file: File) => {
    const formData = new FormData();
    formData.append('manifest', file);
    const { data } = await api.post('/admin/imports/manifest', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  forceState: async (id: string, newState: string, reason: string) => {
    const { data } = await api.patch(`/admin/imports/${id}/force-state`, { 
      newState, 
      reason,
      bypassFSM: true // 👈 Module D Requirement
    });
    return data;
  }
};