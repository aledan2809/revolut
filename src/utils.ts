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
 * Calculate TVA (Romanian VAT) from gross amount
 * @param grossAmount - Amount including TVA
 * @param vatRate - VAT rate (default: 0.19 for 19%)
 * @returns Object with net, vat, and gross amounts
 */
export function calculateTVA(
  grossAmount: number,
  vatRate = 0.19
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
 * @param vatRate - VAT rate (default: 0.19 for 19%)
 * @returns Object with net, vat, and gross amounts
 */
export function addTVA(
  netAmount: number,
  vatRate = 0.19
): { net: number; vat: number; gross: number } {
  const vat = netAmount * vatRate
  const gross = netAmount + vat
  return {
    net: netAmount,
    vat: Math.round(vat * 100) / 100,
    gross: Math.round(gross * 100) / 100,
  }
}
