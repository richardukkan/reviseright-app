'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PLANS } from '@/lib/plans'

declare global { interface Window { Razorpay: any } }

export default function PricingPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(profile)
      }
    }
    load()
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.body.appendChild(script)
  }, [])

  const handleUpgrade = async (planKey: string) => {
    if (!user) { router.push('/signup'); return }
    setSelectedPlan(planKey)
    setLoading(true)

    try {
      const plan = PLANS[planKey as keyof typeof PLANS]
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, amount: plan.price * 100, userId: user.id })
      })
      const order = await res.json()

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'ReviseRight',
        description: `${plan.name} Plan`,
        order_id: order.id,
        prefill: { name: profile?.name, email: profile?.email, contact: profile?.phone },
        theme: { color: '#2563EB' },
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, planKey, userId: user.id })
          })
          const verified = await verifyRes.json()
          if (verified.success) {
            router.push('/dashboard?upgraded=true')
          }
        }
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
    setSelectedPlan('')
  }

  const planList = [
    { key: 'free', ...PLANS.free },
    { key: 'scholar', ...PLANS.scholar },
    { key: 'topper', ...PLANS.topper },
    { key: 'champion', ...PLANS.champion },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Simple, honest pricing</h1>
          <p className="text-gray-500">Pay per page, not per subject. Cancel anytime.</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {planList.map(plan => {
            const isCurrent = profile?.plan === plan.key
            const isFeatured = plan.key === 'topper'
            return (
              <div key={plan.key} className={`bg-white rounded-2xl p-6 border ${isFeatured ? 'border-blue-500 border-2' : 'border-gray-200'}`}>
                {isFeatured && <div className="text-xs font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full inline-block mb-3">Most popular</div>}
                <div className="text-lg font-medium text-gray-900 mb-1">{plan.name}</div>
                <div className="text-3xl font-medium text-blue-600 mb-1">
                  {plan.price === 0 ? '₹0' : `₹${plan.price}`}
                  <span className="text-sm text-gray-400 font-normal">/month</span>
                </div>
                <div className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">{plan.pages} pages/month</div>
                <ul className="space-y-2 mb-6">
                  <li className="text-sm text-gray-600 flex items-center gap-2"><span className="text-blue-600">✓</span>All 9 question types</li>
                  <li className="text-sm text-gray-600 flex items-center gap-2"><span className="text-blue-600">✓</span>View questions online</li>
                  <li className="text-sm text-gray-600 flex items-center gap-2"><span className="text-blue-600">✓</span>All boards supported</li>
                  <li className={`text-sm flex items-center gap-2 ${plan.pdf ? 'text-gray-600' : 'text-gray-300'}`}>
                    <span className={plan.pdf ? 'text-blue-600' : 'text-gray-300'}>{plan.pdf ? '✓' : '✗'}</span>PDF download
                  </li>
                </ul>
                {isCurrent ? (
                  <div className="w-full text-center py-2 text-sm text-gray-400 border border-gray-100 rounded-lg">Current plan</div>
                ) : plan.price === 0 ? (
                  <Link href="/signup" className="block w-full text-center py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Get started free</Link>
                ) : (
                  <button onClick={() => handleUpgrade(plan.key)} disabled={loading && selectedPlan === plan.key}
                    className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${isFeatured ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    {loading && selectedPlan === plan.key ? 'Loading...' : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
