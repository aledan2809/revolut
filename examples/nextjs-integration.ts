/**
 * Example: Next.js API Route Integration
 *
 * Copy these files to your Next.js project:
 * - /app/api/payments/create/route.ts
 * - /app/api/webhooks/revolut/route.ts
 */

// ============================================
// lib/revolut-client.ts
// ============================================

import { RevolutClient } from '@aledan/revolut-integration'

export function getRevolutClient(): RevolutClient {
  const apiKey = process.env.REVOLUT_API_KEY
  if (!apiKey) {
    throw new Error('REVOLUT_API_KEY environment variable not set')
  }

  return new RevolutClient({
    apiKey,
    environment:
      process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    webhookSecret: process.env.REVOLUT_WEBHOOK_SECRET,
  })
}

// ============================================
// app/api/payments/create/route.ts
// ============================================

import { NextResponse } from 'next/server'
// import { getServerSession } from 'next-auth'
// import { db } from '@/lib/db'
import { generateOrderRef } from '@aledan/revolut-integration'
// import { getRevolutClient } from '@/lib/revolut-client'

export async function POST(req: Request) {
  try {
    // 1. Verify user is authenticated
    // const session = await getServerSession()
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // 2. Parse request
    const { apartamentId, suma, luna, an } = await req.json()

    // 3. Validate amount
    if (!suma || suma <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // 4. Get customer email from database
    // const apartament = await db.apartament.findUnique({
    //   where: { id: apartamentId },
    //   include: { proprietari: { include: { user: true } } }
    // })
    // const customerEmail = apartament?.proprietari[0]?.user?.email

    // 5. Create Revolut order
    const client = getRevolutClient()
    const orderRef = generateOrderRef(`APT-${apartamentId}`)

    const order = await client.createOrder({
      amount: suma,
      merchantOrderRef: orderRef,
      customerEmail: 'customer@example.com', // customerEmail
      description: `Plată întreținere ${luna}/${an}`,
      redirectUrl: `${process.env.NEXT_PUBLIC_URL}/plata/succes?ref=${orderRef}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_URL}/plata/anulat`,
    })

    // 6. Save order to database for tracking
    // await db.plataRevolt.create({
    //   data: {
    //     orderId: order.id,
    //     orderRef,
    //     apartamentId,
    //     suma,
    //     luna,
    //     an,
    //     status: 'PENDING',
    //   }
    // })

    // 7. Return checkout URL
    return NextResponse.json({
      checkoutUrl: order.checkout_url,
      orderRef,
    })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}

// ============================================
// app/api/webhooks/revolut/route.ts
// ============================================

// import { db } from '@/lib/db'
// import { getRevolutClient } from '@/lib/revolut-client'

export async function POST_webhook(req: Request) {
  try {
    const client = getRevolutClient()

    // 1. Get raw body and signature
    const rawBody = await req.text()
    const signature = req.headers.get('Revolut-Signature') || ''

    // 2. Verify and parse webhook
    const payload = client.parseWebhook(rawBody, signature)
    if (!payload) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 401 })
    }

    console.log('Revolut webhook received:', payload.event, payload.order_id)

    // 3. Process based on event type
    switch (payload.event) {
      case 'ORDER_COMPLETED': {
        // Payment successful - update database
        // await db.plataRevolt.update({
        //   where: { orderRef: payload.merchant_order_ext_ref },
        //   data: {
        //     status: 'COMPLETED',
        //     completedAt: new Date(),
        //   }
        // })

        // Create actual payment record
        // await createPaymentRecord(payload.merchant_order_ext_ref!)
        console.log('Payment completed:', payload.merchant_order_ext_ref)
        break
      }

      case 'ORDER_CANCELLED':
      case 'ORDER_PAYMENT_FAILED':
      case 'ORDER_PAYMENT_DECLINED': {
        // Payment failed - update database
        // await db.plataRevolt.update({
        //   where: { orderRef: payload.merchant_order_ext_ref },
        //   data: { status: 'FAILED' }
        // })
        console.log('Payment failed:', payload.event, payload.merchant_order_ext_ref)
        break
      }

      case 'REFUND_COMPLETED': {
        // Refund processed
        console.log('Refund completed:', payload.order_id)
        break
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
