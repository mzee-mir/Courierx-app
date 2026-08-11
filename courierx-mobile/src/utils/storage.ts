import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'courierx_jwt_token';
const USER_DATA_KEY = 'courierx_user_data';

export const storage = {
  async saveAuth(token: string, user: object): Promise<void> {
    try {
      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
        SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(user)),
      ]);
    } catch (error) {
      console.error('STORAGE_ERROR: Failed to save auth session', error);
    }
  },

  async getAuth(): Promise<{ token: string | null; user: any | null }> {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(AUTH_TOKEN_KEY),
        SecureStore.getItemAsync(USER_DATA_KEY),
      ]);
      return {
        token,
        user: userJson ? JSON.parse(userJson) : null,
      };
    } catch (error) {
      return { token: null, user: null };
    }
  },

  async clearAuth(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_DATA_KEY),
    ]);
  }
};