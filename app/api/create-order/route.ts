import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: NextRequest) {
  try {
    const { planKey, amount, userId } = await req.json()
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `rr_${userId}_${planKey}_${Date.now()}`,
      notes: { userId, planKey }
    })
    return NextResponse.json(order)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
