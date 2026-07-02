import { Suspense } from 'react'
import ResultsContent from './ResultsContent'

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div style={{color:"#6B7280"}}>Loading...</div></div>}>
      <ResultsContent />
    </Suspense>
  )
}
