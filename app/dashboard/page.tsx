'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PLANS } from '@/lib/plans'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      // Check for expired paid plan and downgrade to Free if lapsed
      if (
        profile &&
        profile.plan !== 'free' &&
        profile.plan_expires_at &&
        new Date(profile.plan_expires_at) < new Date()
      ) {
        await supabase
          .from('profiles')
          .update({
            plan: 'free',
            pages_used: 0,
            pages_reset_at: new Date().toISOString(),
            plan_expires_at: null,
          })
          .eq('id', user.id)

        // Re-fetch so the UI reflects the downgrade immediately
        const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        profile = refreshed
      }

      setProfile(profile)
      const { data: sets } = await supabase.from('question_sets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
      setHistory(sets || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>

  const plan = PLANS[profile?.plan as keyof typeof PLANS] || PLANS.free
  const pagesUsed = profile?.pages_used || 0
  const pagesTotal = plan.pages
  const pagesPercent = Math.min((pagesUsed / pagesTotal) * 100, 100)

  const expiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Welcome back, {profile?.name?.split(' ')[0]} 👋</h1>
            <p className="text-gray-500 text-sm mt-1">Ready to generate revision questions?</p>
          </div>
          <Link href="/generate" className="btn-primary">+ New chapter</Link>
        </div>

        {/* Usage card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500">Pages used this month</p>
                <p className="text-2xl font-medium text-gray-900">{pagesUsed} <span className="text-gray-400 text-base font-normal">/ {pagesTotal}</span></p>
              </div>
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{plan.name} plan</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${pagesPercent}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">{pagesTotal - pagesUsed} pages remaining this month</p>
            {expiresAt && daysLeft !== null && (
              <p className="text-xs text-gray-400 mt-1">
                {daysLeft > 0
                  ? `Renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`
                  : 'Plan expired — renew to keep your pages'}
              </p>
            )}
          </div>
          <div className="card flex flex-col items-center justify-center text-center">
            <p className="text-sm text-gray-500 mb-2">Want more pages?</p>
            <Link href="/pricing" className="btn-primary text-xs px-4 py-2">Upgrade plan</Link>
          </div>
        </div>

        {/* History */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-4">Recent question sets</h2>
          {history.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm mb-4">No question sets yet</p>
              <Link href="/generate" className="btn-primary">Generate your first set</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(set => (
                <div key={set.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{set.subject || 'General'} — Class {set.class_level}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{set.pages_used} pages · {new Date(set.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <Link href={`/results?id=${set.id}`} className="btn-outline text-xs px-3 py-1.5">View</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
