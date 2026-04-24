/**
 * Example: Next.js API Route Integration
 *
 * This example shows how to integrate the Revolut package with Next.js App Router.
 *
 * SETUP STEPS:
 *
 * 1. Install dependencies:
 *    npm install @aledan/revolut-integration
 *
 * 2. Set environment variables in .env.local:
 *    REVOLUT_API_KEY=your_api_key_here
 *    REVOLUT_WEBHOOK_SECRET=your_webhook_secret_here
 *    NEXT_PUBLIC_URL=https://yourdomain.com
 *
 * 3. Copy these files to your Next.js project:
 *    - /lib/revolut-client.ts
 *    - /app/api/payments/create/route.ts
 *    - /app/api/webhooks/revolut/route.ts
 *
 * 4. Configure Revolut webhook URL in Business Dashboard:
 *    https://yourdomain.com/api/webhooks/revolut
 *
 * 5. Uncomment and adapt database code for your schema
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
    // TODO: Uncomment and configure authentication for your project
    // const session = await getServerSession(authOptions) // Configure authOptions
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // 2. Parse request
    const { apartmentId, amount, month, year, customerEmail } = await req.json()

    // 3. Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!customerEmail || !customerEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid customer email is required' },
        { status: 400 }
      )
    }

    // 4. Get customer details from database (if needed)
    // TODO: Implement your database logic here
    // Example for Prisma:
    // const customer = await db.customer.findUnique({
    //   where: { id: customerId },
    //   select: { email: true, name: true }
    // })

    // 5. Create Revolut order
    const client = getRevolutClient()
    const orderRef = generateOrderRef(apartmentId ? `APT-${apartmentId}` : 'PAY')

    const order = await client.createOrder({
      amount: amount,
      merchantOrderRef: orderRef,
      customerEmail: customerEmail,
      description: `Payment ${month ? `for ${month}/${year}` : `- ${orderRef}`}`,
      redirectUrl: `${process.env.NEXT_PUBLIC_URL}/payment/success?ref=${orderRef}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_URL}/payment/cancelled`,
      metadata: {
        apartmentId: apartmentId || '',
        month: month || '',
        year: year || '',
      }
    })

    // 6. Save order to database for tracking
    // TODO: Implement your database logic here
    // Example for Prisma:
    // await db.payment.create({
    //   data: {
    //     revolutOrderId: order.id,
    //     orderRef,
    //     apartmentId,
    //     amount,
    //     customerEmail,
    //     status: 'PENDING',
    //     createdAt: new Date(),
    //   }
    // })

    // 7. Return checkout URL
    return NextResponse.json({
      success: true,
      checkoutUrl: order.checkout_url,
      orderRef,
      orderId: order.id,
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
import { getRevolutClient } from '@/lib/revolut-client'

export async function POST(req: Request) {
  try {
    const client = getRevolutClient()

    // 1. Get raw body and signature
    const rawBody = await req.text()
    const signature = req.headers.get('Revolut-Signature') || ''

    // 2. Verify and parse webhook
    let payload
    try {
      payload = client.parseWebhook(rawBody, signature)
      if (!payload) {
        console.error('Invalid webhook signature or malformed JSON')
        return new Response('Invalid webhook', { status: 401 })
      }
    } catch (error) {
      console.error('Webhook verification failed:', error.message)
      return new Response('Webhook verification failed', { status: 401 })
    }

    console.log('Revolut webhook received:', payload.event, payload.order_id)

    // 3. Process based on event type
    switch (payload.event) {
      case 'ORDER_COMPLETED': {
        // Payment successful - update database
        // TODO: Implement your database logic here
        // Example for Prisma:
        // await db.payment.update({
        //   where: { orderRef: payload.merchant_order_ext_ref },
        //   data: {
        //     status: 'COMPLETED',
        //     revolutOrderId: payload.order_id,
        //     completedAt: new Date(),
        //   }
        // })

        console.log('✅ Payment completed:', payload.merchant_order_ext_ref)

        // TODO: Add your business logic here (send confirmation email, update inventory, etc.)
        break
      }

      case 'ORDER_CANCELLED':
      case 'ORDER_PAYMENT_FAILED':
      case 'ORDER_PAYMENT_DECLINED': {
        // Payment failed - update database
        // TODO: Implement your database logic here
        // await db.payment.update({
        //   where: { orderRef: payload.merchant_order_ext_ref },
        //   data: {
        //     status: 'FAILED',
        //     failureReason: payload.event
        //   }
        // })

        console.log('❌ Payment failed:', payload.event, payload.merchant_order_ext_ref)

        // TODO: Add your business logic here (send failure notification, release reserved items, etc.)
        break
      }

      case 'ORDER_PAYMENT_AUTHORISED': {
        // Payment authorized but not yet captured (for two-phase payments)
        // TODO: Decide whether to capture automatically or manually
        // For auto-capture:
        // const captureResult = await client.captureOrder(payload.order_id)

        console.log('🔒 Payment authorized:', payload.order_id)
        break
      }

      case 'REFUND_COMPLETED': {
        // Refund processed successfully
        // TODO: Update your database
        // await db.refund.update({
        //   where: { revolutOrderId: payload.order_id },
        //   data: { status: 'COMPLETED' }
        // })

        console.log('💰 Refund completed:', payload.order_id)
        break
      }

      default:
        console.log('🔄 Unhandled webhook event:', payload.event)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
