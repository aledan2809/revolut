# CLAUDE.md - Revolut Integration

## Project Setup

### Type
Reusable npm package / library

### Stack
- **Language**: TypeScript 5.9
- **Build**: tsup (esm + cjs)
- **Testing**: Vitest

### Commands
```bash
npm run build   # Build package
npm run dev     # Watch mode
npm run test    # Run tests
```

---

## Purpose

This is a **reusable library** for Revolut Merchant API integration.
It is designed to be imported by other projects (BlocHub, etc.).

## Key Features

1. **RevolutClient** - Main API client class
2. **Webhook verification** - HMAC-SHA256 signature verification
3. **Utilities** - formatAmount, calculateTVA, generateOrderRef

## Usage in Other Projects

```typescript
import { RevolutClient, generateOrderRef } from '@aledan/revolut-integration'

const client = new RevolutClient({
  apiKey: process.env.REVOLUT_API_KEY!,
  environment: 'production',
})

const order = await client.createOrder({
  amount: 100,
  merchantOrderRef: generateOrderRef(),
  customerEmail: 'user@email.com',
  description: 'Payment',
  redirectUrl: 'https://app.com/success',
  cancelUrl: 'https://app.com/cancel',
})
```

## No Database

This package has NO database dependencies.
Database logic should be in the consuming project.

---

## Files Overview

- `src/client.ts` - RevolutClient class
- `src/types.ts` - TypeScript interfaces
- `src/utils.ts` - Helper functions
- `src/index.ts` - Public exports
