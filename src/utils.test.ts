/**
 * Utility Functions Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatAmount,
  toMinorUnits,
  toMajorUnits,
  generateOrderRef,
  isOrderFinal,
  isOrderSuccessful,
  calculateTVA,
  addTVA,
} from './utils'

describe('Utils', () => {
  describe('formatAmount', () => {
    it('should format RON amounts correctly', () => {
      // Use regex to handle non-breaking spaces and regular spaces
      expect(formatAmount(100)).toMatch(/^100,00\s+RON$/)
      expect(formatAmount(123.45)).toMatch(/^123,45\s+RON$/)
      expect(formatAmount(1000.99)).toMatch(/^1\.000,99\s+RON$/)
    })

    it('should format different currencies', () => {
      // Use regex to handle different types of spaces
      expect(formatAmount(100, 'EUR')).toMatch(/^100,00\s+EUR$/)
      expect(formatAmount(100, 'USD')).toMatch(/^100,00\s+USD$/)
    })

    it('should handle edge cases', () => {
      expect(formatAmount(0)).toMatch(/^0,00\s+RON$/)
      expect(formatAmount(0.01)).toMatch(/^0,01\s+RON$/)
      expect(formatAmount(999999.99)).toMatch(/^999\.999,99\s+RON$/)
    })
  })

  describe('toMinorUnits', () => {
    it('should convert amounts to minor units correctly', () => {
      expect(toMinorUnits(1)).toBe(100)
      expect(toMinorUnits(123.45)).toBe(12345)
      expect(toMinorUnits(0.01)).toBe(1)
      expect(toMinorUnits(99.99)).toBe(9999)
    })

    it('should handle floating point precision', () => {
      // These test cases prevent floating point errors
      expect(toMinorUnits(123.456)).toBe(12346) // Rounded correctly
      expect(toMinorUnits(0.1 + 0.2)).toBe(30) // Should be 30, not 29.999999999999996
    })

    it('should handle zero and negative amounts', () => {
      expect(toMinorUnits(0)).toBe(0)
      expect(toMinorUnits(-50.25)).toBe(-5025)
    })
  })

  describe('toMajorUnits', () => {
    it('should convert minor units to major units', () => {
      expect(toMajorUnits(100)).toBe(1)
      expect(toMajorUnits(12345)).toBe(123.45)
      expect(toMajorUnits(1)).toBe(0.01)
      expect(toMajorUnits(9999)).toBe(99.99)
    })

    it('should handle zero and negative amounts', () => {
      expect(toMajorUnits(0)).toBe(0)
      expect(toMajorUnits(-5025)).toBe(-50.25)
    })
  })

  describe('generateOrderRef', () => {
    beforeEach(() => {
      // Mock Date.now for consistent testing
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should generate order reference with default prefix', () => {
      // Mock Math.random for predictable output
      vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

      const ref = generateOrderRef()

      expect(ref).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]+$/)
      expect(ref).toContain('ORD-')

      Math.random.mockRestore()
    })

    it('should generate order reference with custom prefix', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

      const ref = generateOrderRef('PAYMENT')

      expect(ref).toMatch(/^PAYMENT-[A-Z0-9]+-[A-Z0-9]+$/)
      expect(ref).toContain('PAYMENT-')

      Math.random.mockRestore()
    })

    it('should generate unique references', () => {
      const refs = new Set()

      // Generate multiple refs and ensure uniqueness
      for (let i = 0; i < 100; i++) {
        const ref = generateOrderRef()
        expect(refs.has(ref)).toBe(false)
        refs.add(ref)
      }
    })

    it('should contain uppercase alphanumeric characters only', () => {
      const ref = generateOrderRef('TEST')

      // Should match pattern with hyphens separating uppercase alphanumeric sections
      expect(ref).toMatch(/^TEST-[A-Z0-9]+-[A-Z0-9]+$/)
    })
  })

  describe('isOrderFinal', () => {
    it('should return true for final states', () => {
      expect(isOrderFinal('completed')).toBe(true)
      expect(isOrderFinal('failed')).toBe(true)
      expect(isOrderFinal('cancelled')).toBe(true)
    })

    it('should return false for non-final states', () => {
      expect(isOrderFinal('pending')).toBe(false)
      expect(isOrderFinal('processing')).toBe(false)
      expect(isOrderFinal('authorised')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isOrderFinal('COMPLETED')).toBe(true)
      expect(isOrderFinal('Cancelled')).toBe(true)
      expect(isOrderFinal('FAILED')).toBe(true)
      expect(isOrderFinal('PENDING')).toBe(false)
    })
  })

  describe('isOrderSuccessful', () => {
    it('should return true only for completed state', () => {
      expect(isOrderSuccessful('completed')).toBe(true)
    })

    it('should return false for all other states', () => {
      expect(isOrderSuccessful('failed')).toBe(false)
      expect(isOrderSuccessful('cancelled')).toBe(false)
      expect(isOrderSuccessful('pending')).toBe(false)
      expect(isOrderSuccessful('processing')).toBe(false)
      expect(isOrderSuccessful('authorised')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isOrderSuccessful('COMPLETED')).toBe(true)
      expect(isOrderSuccessful('Completed')).toBe(true)
      expect(isOrderSuccessful('FAILED')).toBe(false)
    })
  })

  describe('calculateTVA', () => {
    it('should calculate TVA from gross amount with default 19% rate', () => {
      const result = calculateTVA(119)

      expect(result.gross).toBe(119)
      expect(result.net).toBe(100)
      expect(result.vat).toBe(19)
    })

    it('should calculate TVA with custom rate', () => {
      // 24% VAT rate
      const result = calculateTVA(124, 0.24)

      expect(result.gross).toBe(124)
      expect(result.net).toBe(100)
      expect(result.vat).toBe(24)
    })

    it('should handle decimal amounts correctly', () => {
      const result = calculateTVA(123.45)

      expect(result.gross).toBe(123.45)
      expect(result.net).toBe(103.74) // 123.45 / 1.19 = 103.739..., rounded to 103.74
      expect(result.vat).toBe(19.71)   // 123.45 - 103.74 = 19.71
    })

    it('should round to 2 decimal places', () => {
      const result = calculateTVA(100.33)

      // Each value should have at most 2 decimal places
      expect(result.net.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.vat.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.gross).toBe(100.33)
    })

    it('should handle edge cases', () => {
      const zeroResult = calculateTVA(0)
      expect(zeroResult.net).toBe(0)
      expect(zeroResult.vat).toBe(0)
      expect(zeroResult.gross).toBe(0)

      const smallResult = calculateTVA(0.01)
      expect(smallResult.gross).toBe(0.01)
      expect(smallResult.net).toBe(0.01) // Rounded
      expect(smallResult.vat).toBe(0)    // Rounded
    })
  })

  describe('addTVA', () => {
    it('should add TVA to net amount with default 19% rate', () => {
      const result = addTVA(100)

      expect(result.net).toBe(100)
      expect(result.vat).toBe(19)
      expect(result.gross).toBe(119)
    })

    it('should add TVA with custom rate', () => {
      // 24% VAT rate
      const result = addTVA(100, 0.24)

      expect(result.net).toBe(100)
      expect(result.vat).toBe(24)
      expect(result.gross).toBe(124)
    })

    it('should handle decimal amounts correctly', () => {
      const result = addTVA(123.45)

      expect(result.net).toBe(123.45)
      expect(result.vat).toBe(23.46) // 123.45 * 0.19 = 23.4555, rounded to 23.46
      expect(result.gross).toBe(146.91) // 123.45 + 23.46 = 146.91
    })

    it('should round to 2 decimal places', () => {
      const result = addTVA(33.33)

      // Each value should have at most 2 decimal places
      expect(result.vat.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.gross.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(result.net).toBe(33.33)
    })

    it('should handle edge cases', () => {
      const zeroResult = addTVA(0)
      expect(zeroResult.net).toBe(0)
      expect(zeroResult.vat).toBe(0)
      expect(zeroResult.gross).toBe(0)

      const smallResult = addTVA(0.01)
      expect(smallResult.net).toBe(0.01)
      expect(smallResult.vat).toBe(0) // 0.01 * 0.19 = 0.0019, rounded to 0
      expect(smallResult.gross).toBe(0.01)
    })

    it('should be consistent with calculateTVA inverse operation', () => {
      const netAmount = 100
      const added = addTVA(netAmount)
      const calculated = calculateTVA(added.gross)

      // Should be approximately equal (allowing for rounding differences)
      expect(Math.abs(calculated.net - netAmount)).toBeLessThan(0.01)
    })
  })
})