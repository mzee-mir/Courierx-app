import dotenv from 'dotenv';

dotenv.config();

/**
 * Service to manage CXC/USD exchange rate.
 * The rate is read from the environment variable CXC_USD_EXCHANGE_RATE.
 * It can be overridden at runtime via setRate for testing purposes.
 */
export class TokenExchangeService {
  private static rate: number | null = null;

  /** Get the current exchange rate (CXC per 1 USD). */
  static getRate(): number {
    if (this.rate !== null) return this.rate;
    const envRate = process.env.CXC_USD_EXCHANGE_RATE;
    if (!envRate) {
      throw new Error('CXC_USD_EXCHANGE_RATE environment variable is not set');
    }
    const parsed = Number(envRate);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error('Invalid CXC_USD_EXCHANGE_RATE value');
    }
    this.rate = parsed;
    return this.rate;
  }

  /** Override the rate (useful for tests). */
  static setRate(newRate: number): void {
    if (newRate <= 0) throw new Error('Rate must be positive');
    this.rate = newRate;
  }

  /** Convert a USD amount to CXC tokens (rounded to integer). */
  static convertUsdToCxc(usdAmount: number): number {
    if (usdAmount < 0) throw new Error('Amount cannot be negative');
    const rate = this.getRate();
    return Math.round(usdAmount * rate);
  }
}
