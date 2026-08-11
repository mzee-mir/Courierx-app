import api from './axios';


/**
 * USER_SERVICE (Partner Context)
 * Governs account lifecycle and global session invalidation.
 */


export const userService = {
  /**
   * terminateSessions: Nuclear option to log out all devices.
   * Increments tokenVersion in DB.
   */
  terminateSessions: async (userId: string) => {
    const { data } = await api.post(`/partner/users/${userId}/terminate-sessions`);
    return data;
  },


  /**
   * getProfile: Fetch hydrated details of the logged-in partner user.
   */
  getProfile: async () => {
    const { data } = await api.get('/partner/profile');
    return data.user; // Returns redacted user object
  },


  /**
   * updatePassword: Self-service security update.
   * Requirement: Triggers tokenVersion increment on success.
   */
  updatePassword: async (payload: any) => {
    const { data } = await api.patch('/partner/profile/password', payload);
    return data;
  }
};