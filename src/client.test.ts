/**
 * RevolutClient Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RevolutClient } from './client'
import { RevolutError } from './types'

// Mock fetch globally
global.fetch = vi.fn()

describe('RevolutClient', () => {
  let client: RevolutClient

  beforeEach(() => {
    vi.resetAllMocks()
    client = new RevolutClient({
      apiKey: 'test-api-key',
      environment: 'sandbox',
      webhookSecret: 'test-webhook-secret',
    })
  })

  describe('constructor', () => {
    it('should set sandbox URL for sandbox environment', () => {
      const sandboxClient = new RevolutClient({
        apiKey: 'test-key',
        environment: 'sandbox',
      })
      // @ts-ignore - accessing private property for testing
      expect(sandboxClient.baseUrl).toBe('https://sandbox-merchant.revolut.com/api/1.0')
    })

    it('should set production URL for production environment', () => {
      const prodClient = new RevolutClient({
        apiKey: 'test-key',
        environment: 'production',
      })
      // @ts-ignore - accessing private property for testing
      expect(prodClient.baseUrl).toBe('https://merchant.revolut.com/api/1.0')
    })
  })

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const mockResponse = {
        id: 'order-123',
        checkout_url: 'https://checkout.revolut.com/order-123',
        state: 'pending',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.createOrder({
        amount: 100,
        merchantOrderRef: 'TEST-ORDER-1',
        customerEmail: 'test@example.com',
        description: 'Test payment',
        redirectUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://sandbox-merchant.revolut.com/api/1.0/orders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            amount: 10000, // Converted to minor units
            currency: 'RON',
            merchant_order_ext_ref: 'TEST-ORDER-1',
            customer_email: 'test@example.com',
            description: 'Test payment',
            redirect_url: 'https://app.com/success',
            cancel_redirect_url: 'https://app.com/cancel',
            metadata: undefined,
          }),
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should throw RevolutError on API error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as Response)

      await expect(
        client.createOrder({
          amount: 100,
          merchantOrderRef: 'TEST-ORDER-1',
          customerEmail: 'test@example.com',
          description: 'Test payment',
          redirectUrl: 'https://app.com/success',
          cancelUrl: 'https://app.com/cancel',
        })
      ).rejects.toThrow(RevolutError)
    })

    it('should convert amount to minor units correctly', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order-123' }),
      } as Response)

      await client.createOrder({
        amount: 123.45,
        merchantOrderRef: 'TEST-ORDER-1',
        customerEmail: 'test@example.com',
        description: 'Test payment',
        redirectUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      })

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string)
      expect(body.amount).toBe(12345) // 123.45 * 100
    })
  })

  describe('getOrder', () => {
    it('should retrieve order successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        state: 'completed',
        amount: 10000,
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder,
      } as Response)

      const result = await client.getOrder('order-123')

      expect(fetch).toHaveBeenCalledWith(
        'https://sandbox-merchant.revolut.com/api/1.0/orders/order-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      )

      expect(result).toEqual(mockOrder)
    })

    it('should throw RevolutError when order not found', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      await expect(client.getOrder('nonexistent')).rejects.toThrow(RevolutError)
    })
  })

  describe('verifyWebhookSignature', () => {
    it('should return true for valid signature', () => {
      const payload = '{"event":"ORDER_COMPLETED","order_id":"123"}'
      // Calculate real HMAC with test secret
      const crypto = require('crypto')
      const expectedHash = crypto.createHmac('sha256', 'test-webhook-secret')
        .update(payload)
        .digest('hex')

      const result = client.verifyWebhookSignature(payload, expectedHash)
      expect(result).toBe(true)
    })

    it('should return false for invalid signature', () => {
      const payload = '{"event":"ORDER_COMPLETED","order_id":"123"}'
      const invalidSignature = 'invalid-signature'

      const result = client.verifyWebhookSignature(payload, invalidSignature)
      expect(result).toBe(false)
    })

    it('should throw RevolutError when webhook secret is not configured', () => {
      const clientWithoutSecret = new RevolutClient({
        apiKey: 'test-key',
        environment: 'sandbox',
        // No webhookSecret
      })

      expect(() => {
        clientWithoutSecret.verifyWebhookSignature('payload', 'signature')
      }).toThrow(RevolutError)

      expect(() => {
        clientWithoutSecret.verifyWebhookSignature('payload', 'signature')
      }).toThrow('Webhook secret not configured')
    })

    it('should return false for signatures of different lengths', () => {
      const payload = '{"event":"ORDER_COMPLETED"}'
      const shortSignature = '1234'

      const result = client.verifyWebhookSignature(payload, shortSignature)
      expect(result).toBe(false)
    })
  })

  describe('parseWebhook', () => {
    it('should parse valid webhook payload', () => {
      // Mock successful signature verification
      vi.spyOn(client, 'verifyWebhookSignature').mockReturnValue(true)

      const rawBody = JSON.stringify({
        event: 'ORDER_COMPLETED',
        order_id: 'order-123',
        merchant_order_ext_ref: 'TEST-ORDER-1',
      })

      const result = client.parseWebhook(rawBody, 'valid-signature')

      expect(result).toEqual({
        event: 'ORDER_COMPLETED',
        order_id: 'order-123',
        merchant_order_ext_ref: 'TEST-ORDER-1',
      })
    })

    it('should return null for invalid signature', () => {
      // Mock failed signature verification
      vi.spyOn(client, 'verifyWebhookSignature').mockReturnValue(false)

      const result = client.parseWebhook('payload', 'invalid-signature')
      expect(result).toBeNull()
    })

    it('should return null for malformed JSON', () => {
      // Mock successful signature verification
      vi.spyOn(client, 'verifyWebhookSignature').mockReturnValue(true)

      const result = client.parseWebhook('invalid-json', 'valid-signature')
      expect(result).toBeNull()
    })
  })

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const mockResponse = {
        id: 'order-123',
        state: 'cancelled',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.cancelOrder('order-123')

      expect(fetch).toHaveBeenCalledWith(
        'https://sandbox-merchant.revolut.com/api/1.0/orders/order-123/cancel',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      )

      expect(result).toEqual(mockResponse)
    })
  })

  describe('refundOrder', () => {
    it('should refund full order when no amount specified', async () => {
      const mockResponse = {
        id: 'refund-123',
        amount: 10000,
        state: 'completed',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.refundOrder('order-123')

      expect(fetch).toHaveBeenCalledWith(
        'https://sandbox-merchant.revolut.com/api/1.0/orders/order-123/refund',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}), // No amount = full refund
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should refund partial amount when specified', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'refund-123' }),
      } as Response)

      await client.refundOrder('order-123', 50.25, 'RON')

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string)

      expect(body.amount).toBe(5025) // 50.25 * 100
      expect(body.currency).toBe('RON')
    })
  })

  describe('captureOrder', () => {
    it('should capture full authorized amount', async () => {
      const mockResponse = {
        id: 'order-123',
        state: 'completed',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await client.captureOrder('order-123')

      expect(fetch).toHaveBeenCalledWith(
        'https://sandbox-merchant.revolut.com/api/1.0/orders/order-123/capture',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}), // No amount = capture full
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should capture partial amount when specified', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order-123' }),
      } as Response)

      await client.captureOrder('order-123', 75.50)

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string)

      expect(body.amount).toBe(7550) // 75.50 * 100
    })
  })
})