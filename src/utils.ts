/**
 * Utility functions for Revolut integration
 */

/**
 * Format amount for display in Romanian format
 */
export function formatAmount(amount: number, currency = 'RON'): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Convert major units to minor units (e.g., RON to bani)
 */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Convert minor units to major units (e.g., bani to RON)
 */
export function toMajorUnits(amount: number): number {
  return amount / 100
}

/**
 * Generate a unique order reference
 * Format: PREFIX-TIMESTAMP-RANDOM
 */
export function generateOrderRef(prefix = 'ORD'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Check if an order state is final (completed, failed, or cancelled)
 */
export function isOrderFinal(state: string): boolean {
  return ['completed', 'failed', 'cancelled'].includes(state.toLowerCase())
}

/**
 * Check if an order is successful
 */
export function isOrderSuccessful(state: string): boolean {
  return state.toLowerCase() === 'completed'
}

/**
 * Romania's standard VAT (TVA) rate. 21% since 2025-08-01.
 * @see https://marosavat.com/vat-news/romanian-vat-rate-changes
 */
export const DEFAULT_TVA_RATE = 0.21

/**
 * Romania's previous standard VAT (TVA) rate, in force before 2025-08-01.
 * Kept available for historical / back-dated calculations.
 */
export const LEGACY_TVA_RATE = 0.19

/**
 * Date on which Romania's standard VAT rate changed from 19% to 21%.
 */
export const TVA_RATE_CHANGE_DATE = new Date('2025-08-01T00:00:00Z')

/**
 * Resolve the Romanian standard VAT rate effective on a given date.
 * Returns 0.21 on/after 2025-08-01, otherwise 0.19.
 * @param date - Date to resolve the rate for (defaults to now)
 */
export function getStandardTVARate(date: Date = new Date()): number {
  return date >= TVA_RATE_CHANGE_DATE ? DEFAULT_TVA_RATE : LEGACY_TVA_RATE
}

/**
 * Calculate TVA (Romanian VAT) from gross amount
 * @param grossAmount - Amount including TVA
 * @param vatRate - VAT rate (default: 0.21 for 21%, Romania's standard since 2025-08-01)
 * @returns Object with net, vat, and gross amounts
 */
export function calculateTVA(
  grossAmount: number,
  vatRate = DEFAULT_TVA_RATE
): { net: number; vat: number; gross: number } {
  const net = grossAmount / (1 + vatRate)
  const vat = grossAmount - net
  return {
    net: Math.round(net * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    gross: grossAmount,
  }
}

/**
 * Add TVA (Romanian VAT) to net amount
 * @param netAmount - Amount without TVA
 * @param vatRate - VAT rate (default: 0.21 for 21%, Romania's standard since 2025-08-01)
 * @returns Object with net, vat, and gross amounts
 */
export function addTVA(
  netAmount: number,
  vatRate = DEFAULT_TVA_RATE
): { net: number; vat: number; gross: number } {
  const vat = netAmount * vatRate
  const gross = netAmount + vat
  return {
    net: netAmount,
    vat: Math.round(vat * 100) / 100,
    gross: Math.round(gross * 100) / 100,
  }
}
