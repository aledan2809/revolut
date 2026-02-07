# Revolut Integration

O bibliotecă reutilizabilă pentru integrarea cu Revolut Merchant API. Suportă procesarea plăților, webhook-uri și rambursări.

## Instalare

```bash
npm install @aledan/revolut-integration
# sau
yarn add @aledan/revolut-integration
```

## Cerințe Revolut Business

### Ce trebuie să activezi în Revolut:

1. **Cont Revolut Business** (nu personal!)
   - Trebuie să ai deja un cont Revolut Business verificat
   - Dacă nu ai: https://www.revolut.com/business/

2. **Activare Merchant API**
   - Intră în Revolut Business → Settings → Merchant API
   - Sau direct: https://business.revolut.com/settings/merchant-api

3. **Generare API Key**
   - În Merchant API settings → "Generate new API key"
   - Salvează key-ul (se afișează o singură dată!)
   - Alege environment: Sandbox (test) sau Production (live)

4. **Configurare Webhook** (opțional dar recomandat)
   - În Merchant API → Webhooks → Add webhook
   - URL: `https://your-app.com/api/webhooks/revolut`
   - Events: bifează `ORDER_COMPLETED`, `ORDER_CANCELLED`, `ORDER_PAYMENT_FAILED`
   - Salvează Webhook Secret

### Mediul Sandbox vs Production

| Aspect | Sandbox | Production |
|--------|---------|------------|
| URL | sandbox-merchant.revolut.com | merchant.revolut.com |
| Carduri test | 4929420573595709 | Carduri reale |
| Bani | Virtuali | Reali |
| Când folosești | Development/Testing | După lansare |

### Carduri de test (Sandbox)

| Card | Comportament |
|------|--------------|
| 4929 4205 7359 5709 | Plată reușită |
| 4000 0000 0000 0002 | Plată eșuată |
| 4000 0025 0000 3155 | Necesită 3DS |

Exp: orice dată viitoare, CVV: orice 3 cifre

## Utilizare

### Inițializare client

```typescript
import { RevolutClient } from '@aledan/revolut-integration'

const client = new RevolutClient({
  apiKey: process.env.REVOLUT_API_KEY!,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  webhookSecret: process.env.REVOLUT_WEBHOOK_SECRET, // opțional
})
```

### Creare comandă de plată

```typescript
import { generateOrderRef } from '@aledan/revolut-integration'

const order = await client.createOrder({
  amount: 150.00, // în RON
  merchantOrderRef: generateOrderRef('FACT'),
  customerEmail: 'client@email.com',
  description: 'Întreținere bloc - Ianuarie 2026',
  redirectUrl: 'https://app.ro/plata/succes',
  cancelUrl: 'https://app.ro/plata/anulat',
})

// Redirecționează clientul
console.log('Checkout:', order.checkout_url)
```

### Verificare status comandă

```typescript
const order = await client.getOrder(orderId)
console.log('Status:', order.state) // pending, completed, failed, cancelled
```

### Procesare Webhook (Next.js API Route)

```typescript
// app/api/webhooks/revolut/route.ts
import { RevolutClient, isOrderSuccessful } from '@aledan/revolut-integration'

export async function POST(req: Request) {
  const client = new RevolutClient({
    apiKey: process.env.REVOLUT_API_KEY!,
    environment: 'production',
    webhookSecret: process.env.REVOLUT_WEBHOOK_SECRET,
  })

  const rawBody = await req.text()
  const signature = req.headers.get('Revolut-Signature') || ''

  const payload = client.parseWebhook(rawBody, signature)
  if (!payload) {
    return new Response('Invalid signature', { status: 401 })
  }

  switch (payload.event) {
    case 'ORDER_COMPLETED':
      // Marchează plata ca efectuată în baza de date
      await markPaymentCompleted(payload.merchant_order_ext_ref!)
      break
    case 'ORDER_CANCELLED':
    case 'ORDER_PAYMENT_FAILED':
      // Marchează plata ca eșuată
      await markPaymentFailed(payload.merchant_order_ext_ref!)
      break
  }

  return new Response('OK', { status: 200 })
}
```

### Rambursare

```typescript
// Rambursare totală
await client.refundOrder(orderId)

// Rambursare parțială (50 RON)
await client.refundOrder(orderId, 50)
```

## Variabile de mediu

```env
# .env
REVOLUT_API_KEY=sk_sandbox_xxxxx  # sau sk_live_xxxxx pentru producție
REVOLUT_WEBHOOK_SECRET=whsec_xxxxx
REVOLUT_ENVIRONMENT=sandbox  # sau production
```

## Utilities

```typescript
import {
  formatAmount,
  calculateTVA,
  addTVA,
  generateOrderRef,
  isOrderFinal,
  isOrderSuccessful,
} from '@aledan/revolut-integration'

// Format pentru afișare
formatAmount(100.50) // "100,50 RON"

// Calculează TVA din preț brut
calculateTVA(119) // { net: 100, vat: 19, gross: 119 }

// Adaugă TVA la preț net
addTVA(100) // { net: 100, vat: 19, gross: 119 }

// Generează referință unică
generateOrderRef('FACT') // "FACT-LKJ3F2-A1B2C3"

// Verificări status
isOrderFinal('completed') // true
isOrderSuccessful('completed') // true
```

## Integrare în Proiecte Existente

### BlocHub

```typescript
// src/lib/revolut-client.ts
import { RevolutClient } from '@aledan/revolut-integration'

export function getRevolutClient() {
  if (!process.env.REVOLUT_API_KEY) {
    throw new Error('REVOLUT_API_KEY not configured')
  }

  return new RevolutClient({
    apiKey: process.env.REVOLUT_API_KEY,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    webhookSecret: process.env.REVOLUT_WEBHOOK_SECRET,
  })
}
```

### Next.js App Router

```typescript
// app/api/plati/route.ts
import { getRevolutClient } from '@/lib/revolut-client'
import { generateOrderRef } from '@aledan/revolut-integration'

export async function POST(req: Request) {
  const { apartamentId, suma } = await req.json()

  const client = getRevolutClient()
  const order = await client.createOrder({
    amount: suma,
    merchantOrderRef: generateOrderRef(`APT-${apartamentId}`),
    customerEmail: 'proprietar@email.com',
    description: `Plată întreținere apartament ${apartamentId}`,
    redirectUrl: `${process.env.NEXT_PUBLIC_URL}/plata/succes`,
    cancelUrl: `${process.env.NEXT_PUBLIC_URL}/plata/anulat`,
  })

  return Response.json({ checkoutUrl: order.checkout_url })
}
```

## Suport

Pentru probleme tehnice cu Revolut API:
- Documentație: https://developer.revolut.com/docs/merchant/
- Support: Revolut Business în-app chat

Pentru probleme cu această bibliotecă:
- GitHub Issues: https://github.com/aledan2809/revolut-integration/issues

## License

MIT
