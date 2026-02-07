/**
 * Revolut Merchant API Client
 *
 * A reusable client for Revolut Business payment processing.
 * Supports both sandbox and production environments.
 */

import type {
  RevolutConfig,
  CreateOrderPayload,
  RevolutOrder,
  RefundResult,
  RevolutWebhookPayload,
} from './types'
import { RevolutError } from './types'
import { createHmac } from 'crypto'

export class RevolutClient {
  private apiKey: string
  private baseUrl: string
  private webhookSecret?: string

  constructor(config: RevolutConfig) {
    this.apiKey = config.apiKey
    this.webhookSecret = config.webhookSecret
    this.baseUrl =
      config.environment === 'production'
        ? 'https://merchant.revolut.com/api/1.0'
        : 'https://sandbox-merchant.revolut.com/api/1.0'
  }

  /**
   * Create a new payment order
   * @returns Order object with checkout_url for redirecting customer
   */
  async createOrder(payload: CreateOrderPayload): Promise<RevolutOrder> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(payload.amount * 100), // Convert to minor units
        currency: payload.currency || 'RON',
        merchant_order_ext_ref: payload.merchantOrderRef,
        customer_email: payload.customerEmail,
        description: payload.description,
        redirect_url: payload.redirectUrl,
        cancel_redirect_url: payload.cancelUrl,
        metadata: payload.metadata,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new RevolutError(
        `Failed to create order: ${response.status}`,
        response.status,
        errorText
      )
    }

    return response.json() as Promise<RevolutOrder>
  }

  /**
   * Retrieve an existing order by ID
   */
  async getOrder(orderId: string): Promise<RevolutOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new RevolutError(
        `Failed to get order: ${response.status}`,
        response.status
      )
    }

    return response.json() as Promise<RevolutOrder>
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(orderId: string): Promise<RevolutOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new RevolutError(
        `Failed to cancel order: ${response.status}`,
        response.status
      )
    }

    return response.json() as Promise<RevolutOrder>
  }

  /**
   * Refund an order (full or partial)
   * @param orderId - The order ID to refund
   * @param amount - Optional amount for partial refund (in major units)
   * @param currency - Currency code (default: RON)
   */
  async refundOrder(
    orderId: string,
    amount?: number,
    currency = 'RON'
  ): Promise<RefundResult> {
    const body: Record<string, unknown> = {}
    if (amount !== undefined) {
      body.amount = Math.round(amount * 100)
      body.currency = currency
    }

    const response = await fetch(`${this.baseUrl}/orders/${orderId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new RevolutError(
        `Failed to refund order: ${response.status}`,
        response.status
      )
    }

    return response.json() as Promise<RefundResult>
  }

  /**
   * Capture a previously authorised payment
   */
  async captureOrder(orderId: string, amount?: number): Promise<RevolutOrder> {
    const body: Record<string, unknown> = {}
    if (amount !== undefined) {
      body.amount = Math.round(amount * 100)
    }

    const response = await fetch(`${this.baseUrl}/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new RevolutError(
        `Failed to capture order: ${response.status}`,
        response.status
      )
    }

    return response.json() as Promise<RevolutOrder>
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   * @param payload - Raw webhook body as string
   * @param signature - Signature from Revolut-Signature header
   * @returns true if signature is valid
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('Webhook secret not configured, skipping verification')
      return true
    }

    try {
      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex')

      // Constant-time comparison to prevent timing attacks
      if (expectedSignature.length !== signature.length) {
        return false
      }

      let result = 0
      for (let i = 0; i < expectedSignature.length; i++) {
        result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
      }
      return result === 0
    } catch (error) {
      console.error('Signature verification error:', error)
      return false
    }
  }

  /**
   * Parse and verify a webhook payload
   * @param rawBody - Raw request body
   * @param signature - Revolut-Signature header value
   * @returns Parsed webhook payload or null if invalid
   */
  parseWebhook(
    rawBody: string,
    signature: string
  ): RevolutWebhookPayload | null {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature')
      return null
    }

    try {
      return JSON.parse(rawBody) as RevolutWebhookPayload
    } catch (error) {
      console.error('Failed to parse webhook payload:', error)
      return null
    }
  }
}
