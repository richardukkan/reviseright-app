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
  const [form, setForm] = useState({ name: '', email: '', phone: '', classLevel: '8', password: '', otp: '' })

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name, phone: form.phone, class_level: parseInt(form.classLevel) },
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      })
      console.log('Signup response:', { data, error })
      if (error) {
        setError(error.message || JSON.stringify(error))
        setLoading(false)
        return
      }
      if (data?.user) {
        setStep(2)
      } else {
        setError('Signup failed — please try again.')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err?.message || 'An unexpected error occurred. Please try again.')
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: form.email,
        token: form.otp,
        type: 'signup'
      })
      if (error) {
        setError(error.message || 'Invalid code. Please try again.')
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div style={{width:'100%',maxWidth:'440px'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:'8px',marginBottom:'1.5rem',textDecoration:'none'}}>
            <div style={{width:'32px',height:'32px',background:'#2563EB',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:'500',fontSize:'16px'}}>R</div>
            <span style={{color:'#2563EB',fontWeight:'500',fontSize:'18px'}}>ReviseRight</span>
          </Link>
          <h1 style={{fontSize:'24px',fontWeight:'500',color:'#111827'}}>{step === 1 ? 'Create your account' : 'Verify your email'}</h1>
          <p style={{color:'#6B7280',fontSize:'14px',marginTop:'4px'}}>
            {step === 1 ? 'Start with 10 free pages — no credit card needed' : `We sent a 6-digit code to ${form.email}`}
          </p>
        </div>

        <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:'12px',padding:'1.5rem'}}>
          {step === 1 ? (
            <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
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
                <select className="input" value={form.classLevel} onChange={e => setForm({...form, classLevel: e.target.value})}>
                  {[1,2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" required placeholder="Minimum 6 characters" minLength={6}
                  value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'0.75rem',color:'#DC2626',fontSize:'14px'}}>{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary" style={{justifyContent:'center',padding:'10px',fontSize:'15px',opacity:loading?0.7:1}}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              <div>
                <label className="label">Enter the 6-digit code from your email</label>
                <input className="input" type="text" required maxLength={6} placeholder="000000"
                  style={{textAlign:'center',fontSize:'20px',letterSpacing:'0.2em'}}
                  value={form.otp} onChange={e => setForm({...form, otp: e.target.value})} />
              </div>
              {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'0.75rem',color:'#DC2626',fontSize:'14px'}}>{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary" style={{justifyContent:'center',padding:'10px',fontSize:'15px',opacity:loading?0.7:1}}>
                {loading ? 'Verifying...' : 'Verify email'}
              </button>
              <button type="button" onClick={() => setStep(1)} style={{background:'none',border:'none',color:'#6B7280',fontSize:'14px',cursor:'pointer',textAlign:'center'}}>
                Go back
              </button>
            </form>
          )}
        </div>

        <p style={{textAlign:'center',fontSize:'14px',color:'#6B7280',marginTop:'1rem'}}>
          Already have an account? <Link href="/login" style={{color:'#2563EB'}}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
