'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', otp: '' })

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name, phone: form.phone },
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    })
    if (error) { setError(error.message || 'Signup failed. Please try again.'); setLoading(false); return }
    setStep(2)
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      email: form.email,
      token: form.otp,
      type: 'signup'
    })
    if (error) { setError(error.message || 'Invalid code. Please try again.'); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-medium text-sm">R</div>
            <span className="text-blue-600 font-medium text-lg">ReviseRight</span>
          </Link>
          <h1 className="text-2xl font-medium text-gray-900">{step === 1 ? 'Create your account' : 'Verify your email'}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 1 ? 'Start with 10 free pages — no credit card needed' : `We sent a code to ${form.email}`}
          </p>
        </div>

        <div className="card">
          {step === 1 ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" type="text" required placeholder="Priya Sharma"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" required placeholder="priya@gmail.com"
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="label">Phone number</label>
                <input className="input" type="tel" required placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <label className="label">Which class?</label>
                <select className="input" onChange={e => setForm({...form, ...form})}>
                  {[1,2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" required placeholder="Minimum 8 characters" minLength={8}
                  value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="label">Enter the 6-digit code from your email</label>
                <input className="input text-center text-xl tracking-widest" type="text" required
                  maxLength={6} placeholder="000000"
                  value={form.otp} onChange={e => setForm({...form, otp: e.target.value})} />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? 'Verifying...' : 'Verify email'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-500 w-full text-center">
                Go back
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
