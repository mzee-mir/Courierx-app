export enum InternalAccount {
  SYSTEM_REVENUE = 'SYSTEM:REVENUE',       // Platform commissions
  SYSTEM_ESCROW = 'SYSTEM:ESCROW',         // Funds held during active jobs
  SYSTEM_ADJUSTMENTS = 'SYSTEM:ADJUSTMENTS', // Manual admin corrections
  SYSTEM_CASH_POOL = 'SYSTEM:CASH_POOL',    // Off-platform EVC+ matching pool
  SYSTEM_TOKEN_MINT = 'SYSTEM:TOKEN_MINT',   // Token minting source account
  SYSTEM_TOKEN_BURN = 'SYSTEM:TOKEN_BURN'    // Token burning sink account
}