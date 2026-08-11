import api from './axios';


export const financeService = {
    getSummary: async () => {
        const { data } = await api.get('/partner/finance/summary');
        return data.data;
    },
    requestWithdrawal: async (amount: number, method: string) => {
        const { data } = await api.post('/partner/finance/withdraw', { amount, method });
        return data;
    }
};
