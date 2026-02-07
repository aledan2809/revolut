/**
 * Revolut Merchant API Types
 */

// ============================================
// CONFIGURATION
// ============================================

export interface RevolutConfig {
  /** API key from Revolut Business Merchant Settings */
  apiKey: string
  /** Environment: 'sandbox' for testing, 'production' for live */
  environment: 'sandbox' | 'production'
  /** Optional webhook secret for signature verification */
  webhookSecret?: string
}

// ============================================
// ORDER TYPES
// ============================================

export interface CreateOrderPayload {
  /** Amount in major currency units (e.g., RON, not bani) */
  amount: number
  /** Currency code (default: RON) */
  currency?: string
  /** Your internal order reference */
  merchantOrderRef: string
  /** Customer email for receipts */
  customerEmail: string
  /** Description shown to customer */
  description: string
  /** URL to redirect after successful payment */
  redirectUrl: string
  /** URL to redirect if payment is cancelled */
  cancelUrl: string
  /** Optional metadata */
  metadata?: Record<string, string>
}

export interface RevolutOrder {
  id: string
  public_id: string
  type: string
  state: OrderState
  created_at: string
  updated_at: string
  completed_at?: string
  checkout_url: string
  order_amount: {
    value: number
    currency: string
  }
  merchant_order_ext_ref?: string
}

export type OrderState =
  | 'pending'
  | 'processing'
  | 'authorised'
  | 'completed'
  | 'failed'
  | 'cancelled'

// ============================================
// WEBHOOK TYPES
// ============================================

export type WebhookEvent =
  | 'ORDER_COMPLETED'
  | 'ORDER_PAYMENT_AUTHENTICATED'
  | 'ORDER_PAYMENT_AUTHORISED'
  | 'ORDER_PAYMENT_DECLINED'
  | 'ORDER_PAYMENT_FAILED'
  | 'ORDER_CANCELLED'
  | 'REFUND_COMPLETED'

export interface RevolutWebhookPayload {
  event: WebhookEvent
  timestamp: string
  order_id: string
  merchant_order_ext_ref?: string
  data?: WebhookOrderData
}

export interface WebhookOrderData {
  id: string
  type: string
  state: string
  created_at: string
  updated_at: string
  completed_at?: string
  description?: string
  order_amount: {
    value: number
    currency: string
  }
  payments?: PaymentInfo[]
}

export interface PaymentInfo {
  id: string
  state: string
  payment_method: {
    type: string
    card?: {
      card_brand: string
      card_last_four: string
      card_expiry_month?: number
      card_expiry_year?: number
    }
  }
}

// ============================================
// REFUND TYPES
// ============================================

export interface RefundResult {
  id: string
  state: string
  amount?: {
    value: number
    currency: string
  }
}

// ============================================
// ERROR TYPES
// ============================================

export class RevolutError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string
  ) {
    super(message)
    this.name = 'RevolutError'
  }
}
