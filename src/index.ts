/**
 * Revolut Integration Package
 *
 * A reusable library for Revolut Merchant API integration.
 * Supports payment processing, webhooks, and refunds.
 *
 * @example
 * ```typescript
 * import { RevolutClient } from '@aledan/revolut-integration'
 *
 * const client = new RevolutClient({
 *   apiKey: process.env.REVOLUT_API_KEY!,
 *   environment: 'sandbox',
 *   webhookSecret: process.env.REVOLUT_WEBHOOK_SECRET,
 * })
 *
 * // Create payment order
 * const order = await client.createOrder({
 *   amount: 100.50,
 *   merchantOrderRef: 'INV-001',
 *   customerEmail: 'customer@example.com',
 *   description: 'Plata factura #001',
 *   redirectUrl: 'https://myapp.com/success',
 *   cancelUrl: 'https://myapp.com/cancel',
 * })
 *
 * // Redirect customer to checkout
 * console.log('Checkout URL:', order.checkout_url)
 * ```
 */

// Main client
export { RevolutClient } from './client'

// Types
export type {
  RevolutConfig,
  CreateOrderPayload,
  RevolutOrder,
  OrderState,
  RevolutWebhookPayload,
  WebhookEvent,
  WebhookOrderData,
  PaymentInfo,
  RefundResult,
} from './types'
export { RevolutError } from './types'

// Utilities
export {
  formatAmount,
  toMinorUnits,
  toMajorUnits,
  generateOrderRef,
  isOrderFinal,
  isOrderSuccessful,
  calculateTVA,
  addTVA,
} from './utils'
