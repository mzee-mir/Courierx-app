/**
 * Simulated EVC+ Provider Service
 * In production, this would use Axios to call Hormuud's API
 */
export const simulateEvcPayment = async (phoneNumber: string, amount: number): Promise<{ success: boolean; transactionId: string }> => {
  console.log(`SIMULATION: Sending STK Push to ${phoneNumber} for $${amount}...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Simulate success (95% rate)
  const isSuccess = Math.random() < 0.95;
  
  return {
    success: isSuccess,
    transactionId: `EVC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  };
};