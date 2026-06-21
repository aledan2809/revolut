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
import { createHmac, timingSafeEqual } from 'crypto'

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
   * Verify a Revolut webhook signature using HMAC-SHA256.
   *
   * Conformant with the Revolut Merchant API webhook spec:
   * https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature
   *
   * When a `timestamp` (the `Revolut-Request-Timestamp` header) is supplied,
   * the signed string is `v1.{timestamp}.{rawPayload}` and the result is
   * compared (constant-time) against any `v1=` value parsed from the
   * `Revolut-Signature` header. The header may carry several comma-separated
   * `v1=...` values (e.g. during secret rotation) — a match on any one passes.
   * Replay protection rejects requests whose timestamp is older than
   * `toleranceSeconds` (default 300s = 5 minutes).
   *
   * When no `timestamp` is supplied, falls back to the legacy behaviour of
   * HMAC-ing the raw payload alone (backward compatible).
   *
   * @param payload - Raw webhook body as string
   * @param signature - Value of the `Revolut-Signature` header (may be `v1=<hex>` or raw hex)
   * @param timestamp - Value of the `Revolut-Request-Timestamp` header (ms epoch). Enables spec-conformant + replay-protected verification when provided.
   * @param toleranceSeconds - Max age of the timestamp before the request is rejected as a replay (default 300s)
   * @returns true if signature is valid
   * @throws RevolutError if webhook secret is not configured
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp?: string | number,
    toleranceSeconds = 300
  ): boolean {
    if (!this.webhookSecret) {
      throw new RevolutError(
        'Webhook secret not configured. Set webhookSecret in RevolutConfig to verify webhook authenticity.',
        0,
        'WEBHOOK_SECRET_MISSING'
      )
    }

    try {
      // Candidate hex signatures from the header. The Revolut-Signature header
      // may contain multiple comma-separated values such as
      // "v1=abc...,v1=def..." (secret rotation). Bare hex is also accepted for
      // backward compatibility with the legacy header format.
      const candidates = this.parseSignatureCandidates(signature)
      if (candidates.length === 0) {
        return false
      }

      let signedPayload: string

      if (timestamp !== undefined && timestamp !== null && `${timestamp}` !== '') {
        // Replay protection: reject timestamps outside the tolerance window.
        const ts = Number(timestamp)
        if (!Number.isFinite(ts)) {
          return false
        }
        const ageSeconds = Math.abs(Date.now() - ts) / 1000
        if (ageSeconds > toleranceSeconds) {
          return false
        }
        // Spec-conformant signed string: "v1.{timestamp}.{rawPayload}".
        signedPayload = `v1.${timestamp}.${payload}`
      } else {
        // Legacy fallback: HMAC the raw payload alone.
        signedPayload = payload
      }

      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex')

      // Constant-time comparison against each candidate.
      return candidates.some((candidate) =>
        this.constantTimeEquals(expectedSignature, candidate)
      )
    } catch (error) {
      // Signature verification failed silently - return false
      // Libraries should not log directly to console
      return false
    }
  }

  /**
   * Extract candidate hex signatures from a Revolut-Signature header value.
   * Supports "v1=<hex>" (one or more, comma-separated) and bare "<hex>".
   */
  private parseSignatureCandidates(signature: string): string[] {
    if (!signature) {
      return []
    }
    const candidates: string[] = []
    for (const part of signature.split(',')) {
      const trimmed = part.trim()
      if (!trimmed) {
        continue
      }
      if (trimmed.startsWith('v1=')) {
        const value = trimmed.slice(3).trim()
        if (value) {
          candidates.push(value)
        }
      } else {
        // Bare hex (legacy header format) — keep as-is.
        candidates.push(trimmed)
      }
    }
    return candidates
  }

  /**
   * Constant-time comparison of two hex strings to prevent timing attacks.
   */
  private constantTimeEquals(expected: string, provided: string): boolean {
    if (expected.length !== provided.length) {
      return false
    }
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
    } catch {
      return false
    }
  }

  /**
   * Parse and verify a webhook payload.
   *
   * @param rawBody - Raw request body
   * @param signature - Value of the `Revolut-Signature` header
   * @param timestamp - Value of the `Revolut-Request-Timestamp` header (enables spec-conformant + replay-protected verification when provided)
   * @param toleranceSeconds - Max age of the timestamp before rejection (default 300s)
   * @returns Parsed webhook payload or null if invalid
   */
  parseWebhook(
    rawBody: string,
    signature: string,
    timestamp?: string | number,
    toleranceSeconds = 300
  ): RevolutWebhookPayload | null {
    if (
      !this.verifyWebhookSignature(
        rawBody,
        signature,
        timestamp,
        toleranceSeconds
      )
    ) {
      // Invalid signature - return null (caller should handle)
      return null
    }

    try {
      return JSON.parse(rawBody) as RevolutWebhookPayload
    } catch (error) {
      // Invalid JSON - return null (caller should handle)
      return null
    }
  }
}
