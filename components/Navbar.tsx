'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar({ user }: { user?: any }) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="flex items-center px-8 py-4 border-b border-gray-200 bg-white sticky top-0 z-50">
      <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-medium text-sm">R</div>
        <span className="text-blue-600 font-medium text-lg">ReviseRight</span>
      </Link>
      <div className="flex-1" />
      {user ? (
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/generate" className="btn-primary">New chapter</Link>
          <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900">Account</Link>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Log out</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-outline">Log in</Link>
          <Link href="/signup" className="btn-primary">Start free</Link>
        </div>
      )}
    </nav>
  )
}
