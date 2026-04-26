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

## Governance Reference
See: `Master/knowledge/MASTER_SYSTEM.md` §1-§5. This library follows Master governance; do not duplicate rules.
This is a shared library — modifications cascade to consumers (per `Master/CLASSIFICATION.md` §6.1). Before any patch / rebuild / rsync that affects `dist/`:
1. List consumers: `grep -lE "\"@aledan/<libname>\"" $PROJECTS_ROOT/*/package.json`
2. If any consumer is NO-TOUCH CRITIC (PRO, eCabinet, Tester, 4uPDF, procuchaingo2), apply propose-confirm-apply protocol per Master `CLAUDE.md` §2d.
3. Never use `rsync --delete` on `dist/` — preserves CJS/ESM format variants referenced by `exports` map.
4. Post-deploy, spot-check NO-TOUCH consumer health (Master `CLASSIFICATION.md` §6.1).
