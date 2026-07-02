'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PLANS } from '@/lib/plans'

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', class_level: 8 })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      setForm({ name: profile?.name || '', phone: profile?.phone || '', class_level: profile?.class_level || 8 })
      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update(form).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>

  const plan = PLANS[profile?.plan as keyof typeof PLANS] || PLANS.free
  const pagesUsed = profile?.pages_used || 0
  const pagesPercent = Math.min((pagesUsed / plan.pages) * 100, 100)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-medium text-gray-900 mb-8">Account settings</h1>

        {/* Plan info */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-900">Current plan</h2>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{plan.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Pages used this month</span>
            <span className="font-medium">{pagesUsed} / {plan.pages}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pagesPercent}%` }} />
          </div>
          {profile?.plan !== 'champion' && (
            <Link href="/pricing" className="btn-primary text-sm">Upgrade plan</Link>
          )}
        </div>

        {/* Profile form */}
        <div className="card mb-6">
          <h2 className="font-medium text-gray-900 mb-4">Profile details</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" type="text" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" value={user?.email} readOnly style={{width:"100%",border:"1px solid #D1D5DB",borderRadius:"0.5rem",padding:"0.625rem 0.75rem",fontSize:"0.875rem",background:"#F9FAFB",color:"#9CA3AF"}} />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="label">Phone number</label>
              <input className="input" type="tel" value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <label className="label">Class</label>
              <select className="input" value={form.class_level}
                onChange={e => setForm({...form, class_level: Number(e.target.value)})}>
                {[1,2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div className="card border-red-100">
          <h2 className="font-medium text-gray-900 mb-2">Sign out</h2>
          <p className="text-sm text-gray-500 mb-4">You'll need to log in again to access your account.</p>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            className="btn-outline text-red-600 border-red-200 hover:bg-red-50">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
