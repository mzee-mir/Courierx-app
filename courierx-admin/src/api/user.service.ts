import api from './axios';

export interface UserFilterParams {
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InsightParams {
  startDate?: string;
  endDate?: string;
  vehicleType?: string;
  page?: number;
  limit?: number;
}

export const userService = {
  /**
   * USER DIRECTORY: Fetch and search all users (Customers & Drivers)
   */
  getUsers: async (params: UserFilterParams) => {
    const { data } = await api.get('/admin/users', { params });
    return data;
  },

  /**
   * SECURITY: Suspend or Reactivate a user account with a reason
   */
  toggleStatus: async (id: string, isSuspended: boolean, reason: string) => {
    const { data } = await api.patch(`/admin/users/${id}/status`, { 
      isSuspended, 
      reason 
    });
    return data;
  },

  /**
   * INSIGHTS OVERVIEW: Fetches the summary data for the 3 dashboard cards
   */
  getInsights: async (params: InsightParams) => {
    const response = await api.get('/admin/customers/insights', { params });
    // Returns { vips: [], risk: [], dormant: [] }
    return response.data.data;
  },

  /**
   * VIP DETAIL: Paginated deep-dive into top spenders
   */
  getVIPs: async (params: InsightParams) => {
    const { data } = await api.get('/admin/customers/insights/vips', { params });
    return data; // Returns { success: true, data: [], pagination: {} }
  },

  /**
   * DORMANT DETAIL: Paginated list of high-value users who stopped ordering
   */
  getDormant: async (params: InsightParams) => {
    const { data } = await api.get('/admin/customers/insights/dormant', { params });
    return data; // Returns { success: true, data: [], pagination: {} }
  },

  /**
   * RISK DETAIL: Paginated list of users with high disputes/cancellations
   */
  getRisk: async (params: InsightParams) => {
    const { data } = await api.get('/admin/customers/insights/risk', { params });
    return data; // Returns { success: true, data: [], pagination: {} }
  },

  /**
   * USER PROFILE: Fetch full details for a single specific user
   */
  getUserById: async (id: string) => {
    const { data } = await api.get(`/admin/users/${id}`);
    return data.user;
  },
  terminateSessions: async (id: string) => {
    const { data } = await api.post(`/admin/users/${id}/terminate-sessions`);
    return data;
  }
};