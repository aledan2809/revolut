/**
 * Types Tests
 */

import { describe, it, expect } from 'vitest'
import { RevolutError } from './types'

describe('Types', () => {
  describe('RevolutError', () => {
    it('should create error with message and status code', () => {
      const error = new RevolutError('Payment failed', 400)

      expect(error.message).toBe('Payment failed')
      expect(error.statusCode).toBe(400)
      expect(error.name).toBe('RevolutError')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(RevolutError)
    })

    it('should create error with response body', () => {
      const responseBody = '{"error": "invalid_request", "message": "Invalid amount"}'
      const error = new RevolutError('Invalid request', 400, responseBody)

      expect(error.message).toBe('Invalid request')
      expect(error.statusCode).toBe(400)
      expect(error.response).toBe(responseBody)
    })

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new RevolutError('Test error', 500)
      }).toThrow(RevolutError)

      expect(() => {
        throw new RevolutError('Test error', 500)
      }).toThrow('Test error')
    })

    it('should work with try-catch blocks', () => {
      let caughtError: RevolutError | null = null

      try {
        throw new RevolutError('API Error', 401, 'Unauthorized')
      } catch (error) {
        if (error instanceof RevolutError) {
          caughtError = error
        }
      }

      expect(caughtError).not.toBeNull()
      expect(caughtError?.statusCode).toBe(401)
      expect(caughtError?.response).toBe('Unauthorized')
    })

    it('should preserve stack trace', () => {
      const error = new RevolutError('Stack test', 500)

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('RevolutError')
    })
  })
})