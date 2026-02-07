# Revolut Integration - Project Overview

## Changelog
- [2026-02-07] v1.0.0: Initial creation - extracted from BlocHub

---

## Business Purpose

Provide a reusable Revolut Merchant API client that can be shared across multiple projects:
- BlocHub (building management)
- eProfit (tax estimation)
- Future projects requiring payments

## Technical Architecture

### Package Structure
```
revolut-integration/
├── src/
│   ├── index.ts      # Public exports
│   ├── client.ts     # RevolutClient class
│   ├── types.ts      # TypeScript types
│   └── utils.ts      # Helper functions
├── package.json
├── tsconfig.json
└── README.md
```

### Key Components

1. **RevolutClient**
   - createOrder() - Create payment order
   - getOrder() - Check order status
   - cancelOrder() - Cancel pending order
   - refundOrder() - Full or partial refund
   - captureOrder() - Capture authorized payment
   - verifyWebhookSignature() - HMAC verification
   - parseWebhook() - Parse and verify webhook

2. **Types**
   - RevolutConfig
   - CreateOrderPayload
   - RevolutOrder
   - RevolutWebhookPayload
   - RevolutError

3. **Utilities**
   - formatAmount() - Format for display
   - toMinorUnits() / toMajorUnits() - Currency conversion
   - generateOrderRef() - Unique order reference
   - calculateTVA() / addTVA() - Romanian VAT calculations

---

## API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /orders | Create order |
| GET | /orders/:id | Get order |
| POST | /orders/:id/cancel | Cancel order |
| POST | /orders/:id/refund | Refund order |
| POST | /orders/:id/capture | Capture authorized |

---

## Integration Flow

```
1. Client calls createOrder() with amount and metadata
2. Revolut returns checkout_url
3. Redirect customer to checkout_url
4. Customer completes payment on Revolut
5. Revolut redirects to redirectUrl
6. Webhook notification received at webhook endpoint
7. Verify signature with parseWebhook()
8. Update database based on event type
```

---

## Webhook Events

| Event | Meaning |
|-------|---------|
| ORDER_COMPLETED | Payment successful |
| ORDER_PAYMENT_AUTHORISED | Card authorized, pending capture |
| ORDER_PAYMENT_DECLINED | Payment declined |
| ORDER_PAYMENT_FAILED | Payment failed |
| ORDER_CANCELLED | Order cancelled |
| REFUND_COMPLETED | Refund processed |

---

## Environment Variables

Required by consuming projects:
```env
REVOLUT_API_KEY=sk_sandbox_xxx / sk_live_xxx
REVOLUT_WEBHOOK_SECRET=whsec_xxx (optional but recommended)
REVOLUT_ENVIRONMENT=sandbox / production
```

---

## Dependencies

- None (standalone package)
- Uses native `crypto` for HMAC
- Uses native `fetch` for HTTP

---

## Publishing

```bash
npm run build
npm publish --access public
```

Or use locally via:
```json
{
  "dependencies": {
    "@aledan/revolut-integration": "file:../revolut-integration"
  }
}
```
