'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PLANS } from '@/lib/plans'

export default function ResultsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const setId = params.get('id')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [questionSet, setQuestionSet] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
  const [allRevealed, setAllRevealed] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      if (setId) {
        const { data: set } = await supabase.from('question_sets').select('*').eq('id', setId).eq('user_id', user.id).single()
        setQuestionSet(set)
      }
      setLoading(false)
    }
    load()
  }, [router, setId])

  const toggleAnswer = (key: string) => {
    setRevealedAnswers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAll = () => {
    const next = !allRevealed
    setAllRevealed(next)
    if (next) {
      const all: Record<string, boolean> = {}
      const questions = questionSet?.questions || []
      questions.forEach((_: any, i: number) => { all[i] = true })
      setRevealedAnswers(all)
    } else {
      setRevealedAnswers({})
    }
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const questions = questionSet.questions || []

      // Page dimensions
      const pageW = 210
      const pageH = 297
      const mL = 15        // left margin
      const mR = 15        // right margin
      const cW = pageW - mL - mR  // content width = 180mm
      const mTop = 30      // top margin (below watermark)
      const mBot = 18      // bottom margin (above footer)
      const maxY = pageH - mBot
      const lineH = 5.5   // line height for body text

      const typeLabels: Record<string, string> = {
        mcq: 'MCQ', fill: 'Fill in the Blank', truefalse: 'True or False',
        oneword: 'One Word Answer', short: 'Short Answer', long: 'Long Answer',
        match: 'Match the Following', define: 'Define', critical: 'Critical Thinking'
      }

      const name = profile.name || ''
      const email = profile.email || ''
      const phone = profile.phone || ''

      // Draw top warning bar on current page
      const drawTopBar = () => {
        // Yellow warning background
        doc.setFillColor(255, 243, 205)
        doc.rect(mL, 4, cW, 12, 'F')
        doc.setDrawColor(230, 160, 0)
        doc.setLineWidth(0.4)
        doc.rect(mL, 4, cW, 12, 'S')

        // Warning text — two lines to avoid cutoff
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(120, 60, 0)
        const line1 = `⚠  GENERATED FOR: ${name}  |  ${email}${phone ? '  |  ' + phone : ''}`
        const line2 = `ReviseRight.in  |  NOT FOR REDISTRIBUTION  |  Sharing this document is a violation of terms.`
        doc.text(line1, mL + 2, 10, { maxWidth: cW - 4 })
        doc.text(line2, mL + 2, 14.5, { maxWidth: cW - 4 })
        doc.setLineWidth(0.2)
      }

      // Draw bottom footer
      const drawFooter = (pageNum: number) => {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(160, 160, 160)
        doc.text(`${name} | ${email} | ReviseRight.in`, mL, pageH - 5)
        doc.text(`Page ${pageNum}`, pageW - mR, pageH - 5, { align: 'right' })
        doc.setTextColor(0, 0, 0)
      }

      let y = mTop
      let currentPage = 1
      drawTopBar()
      drawFooter(currentPage)

      // Add new page helper
      const newPage = () => {
        drawFooter(currentPage)
        doc.addPage()
        currentPage++
        y = mTop
        drawTopBar()
      }

      // Estimate height of text block
      const estimateH = (text: string, fontSize: number, width: number): number => {
        doc.setFontSize(fontSize)
        const lines = doc.splitTextToSize(text, width)
        return lines.length * lineH
      }

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(37, 99, 235)
      doc.text(questionSet.subject || 'Revision Questions', mL, y)
      y += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Class ${questionSet.class_level}  ·  ${questions.length} Questions  ·  ReviseRight.in`, mL, y)
      y += 4

      // Title underline
      doc.setDrawColor(37, 99, 235)
      doc.setLineWidth(0.5)
      doc.line(mL, y, pageW - mR, y)
      y += 6
      doc.setLineWidth(0.2)
      doc.setDrawColor(200, 200, 200)

      // Group by type
      const grouped: Record<string, any[]> = {}
      questions.forEach((q: any) => {
        if (!grouped[q.type]) grouped[q.type] = []
        grouped[q.type].push(q)
      })

      let globalNum = 1

      Object.entries(grouped).forEach(([type, qs]) => {
        // Section header — check if it fits
        if (y + 14 > maxY) newPage()

        // Section header bar
        y += 3
        doc.setFillColor(37, 99, 235)
        doc.rect(mL, y - 4, cW, 8, 'F')
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text(`${typeLabels[type] || type}   (${qs.length} question${qs.length > 1 ? 's' : ''})`, mL + 3, y)
        y += 8
        doc.setTextColor(0, 0, 0)

        qs.forEach((q: any) => {
          // Estimate total height needed for this question + answer
          const qText = `${globalNum}. ${q.question}`
          const qH = estimateH(qText, 10, cW)

          let optH = 0
          if (q.options) {
            q.options.forEach((opt: string) => {
              optH += estimateH(opt, 9.5, cW / 2 - 4)
            })
            optH = Math.ceil(q.options.length / 2) * lineH + 4
          }

          const ansH = estimateH(`Answer: ${q.answer}`, 9.5, cW - 10) + 8

          const totalH = qH + optH + ansH + 10

          // If entire Q+A doesn't fit, go to new page
          if (y + totalH > maxY) newPage()

          // Question text — NO box
          y += 3
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(17, 24, 39)
          const qLines = doc.splitTextToSize(qText, cW)
          doc.text(qLines, mL, y)
          y += qLines.length * lineH + 2

          // Options for MCQ — 2 per row
          if (q.options && q.options.length > 0) {
            doc.setFontSize(9.5)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(55, 65, 81)
            for (let i = 0; i < q.options.length; i += 2) {
              const opt1Lines = doc.splitTextToSize(q.options[i] || '', cW / 2 - 4)
              const opt2Lines = q.options[i+1] ? doc.splitTextToSize(q.options[i+1], cW / 2 - 4) : []
              doc.text(opt1Lines, mL + 4, y)
              if (opt2Lines.length > 0) doc.text(opt2Lines, mL + cW / 2 + 2, y)
              y += Math.max(opt1Lines.length, opt2Lines.length || 1) * lineH
            }
            y += 2
          }

          // Answer box — check again if it fits after question
          if (y + ansH > maxY) {
            // Answer doesn't fit — move everything to next page
            // Go back and redraw question on new page
            newPage()
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(17, 24, 39)
            doc.text(qLines, mL, y)
            y += qLines.length * lineH + 2
            if (q.options && q.options.length > 0) {
              doc.setFontSize(9.5)
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(55, 65, 81)
              for (let i = 0; i < q.options.length; i += 2) {
                const opt1Lines = doc.splitTextToSize(q.options[i] || '', cW / 2 - 4)
                const opt2Lines = q.options[i+1] ? doc.splitTextToSize(q.options[i+1], cW / 2 - 4) : []
                doc.text(opt1Lines, mL + 4, y)
                if (opt2Lines.length > 0) doc.text(opt2Lines, mL + cW / 2 + 2, y)
                y += Math.max(opt1Lines.length, opt2Lines.length || 1) * lineH
              }
              y += 2
            }
          }

          // Draw answer box with equal padding on all sides (4mm padding)
          const pad = 4
          const answerLabel = 'Answer:'
          doc.setFontSize(9.5)
          doc.setFont('helvetica', 'normal')
          const answerBody = doc.splitTextToSize(q.answer, cW - pad * 2 - 18)
          const boxH = answerBody.length * lineH + pad * 2 + 2
          
          doc.setFillColor(240, 253, 244)
          doc.setDrawColor(134, 239, 172)
          doc.setLineWidth(0.3)
          doc.rect(mL, y, cW, boxH, 'FD')
          
          // "Answer:" label in bold green
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(22, 101, 52)
          doc.text(answerLabel, mL + pad, y + pad + 3.5)
          
          // Answer content
          doc.setFont('helvetica', 'normal')
          doc.text(answerBody, mL + pad + 18, y + pad + 3.5)
          
          y += boxH + 6

          doc.setTextColor(0, 0, 0)
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.2)

          globalNum++
        })

        y += 4
      })

      // Final page footer
      drawFooter(currentPage)

      doc.save(`ReviseRight-${questionSet.subject}-Class${questionSet.class_level}.pdf`)
    } catch (err: any) {
      console.error('PDF error:', err)
      alert('PDF download failed: ' + err.message)
    }
    setDownloading(false)
  }

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280'}}>Loading...</div>
  if (!questionSet) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280'}}>Question set not found.</div>

  const plan = PLANS[profile?.plan as keyof typeof PLANS] || PLANS.free
  const canDownload = plan.pdf
  const questions = questionSet.questions || []

  const typeLabels: Record<string, string> = {
    mcq: 'MCQ', fill: 'Fill in the blank', truefalse: 'True or False',
    oneword: 'One Word Answer', short: 'Short Answer', long: 'Long Answer',
    match: 'Match the Following', define: 'Define', critical: 'Critical Thinking'
  }

  const groupedQuestions: Record<string, any[]> = {}
  const questionIndices: Record<string, number[]> = {}
  let globalIndex = 0
  questions.forEach((q: any) => {
    if (!groupedQuestions[q.type]) { groupedQuestions[q.type] = []; questionIndices[q.type] = [] }
    groupedQuestions[q.type].push(q)
    questionIndices[q.type].push(globalIndex++)
  })

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB'}}>
      <Navbar user={user} />
      <div style={{maxWidth:'768px',margin:'0 auto',padding:'2.5rem 1.5rem'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem',gap:'1rem',flexWrap:'wrap'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:'500',color:'#111827'}}>{questionSet.subject}</h1>
            <p style={{color:'#6B7280',fontSize:'14px',marginTop:'4px'}}>Class {questionSet.class_level} · {questions.length} questions · {questionSet.pages_used} pages used</p>
          </div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {canDownload ? (
              <button onClick={handleDownloadPDF} disabled={downloading}
                style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'14px',fontWeight:'500',cursor:'pointer',opacity:downloading?0.7:1}}>
                {downloading ? 'Preparing PDF...' : '⬇ Download PDF'}
              </button>
            ) : (
              <Link href="/pricing" style={{background:'transparent',color:'#374151',border:'1px solid #D1D5DB',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:'500',textDecoration:'none'}}>Upgrade for PDF</Link>
            )}
            <Link href="/generate" style={{background:'transparent',color:'#374151',border:'1px solid #D1D5DB',borderRadius:'8px',padding:'9px 18px',fontSize:'14px',fontWeight:'500',textDecoration:'none'}}>+ New chapter</Link>
          </div>
        </div>

        {/* Upgrade banner */}
        {!canDownload && (
          <div style={{background:'#EFF6FF',border:'1px solid #DBEAFE',borderRadius:'12px',padding:'1rem 1.25rem',marginBottom:'1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
            <p style={{fontSize:'14px',fontWeight:'500',color:'#1E3A8A'}}>PDF download available on Topper & Champion plans</p>
            <Link href="/pricing" style={{background:'#2563EB',color:'#fff',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:'500',textDecoration:'none',flexShrink:0}}>Upgrade</Link>
          </div>
        )}

        {/* Reveal all toggle */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'8px'}}>
          <p style={{fontSize:'13px',color:'#6B7280'}}>Click <strong>Show answer</strong> after attempting each question</p>
          <button onClick={toggleAll}
            style={{background:allRevealed?'#F3F4F6':'#2563EB',color:allRevealed?'#374151':'#fff',border:'1px solid',borderColor:allRevealed?'#D1D5DB':'#2563EB',borderRadius:'8px',padding:'7px 16px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>
            {allRevealed ? 'Hide all answers' : 'Reveal all answers'}
          </button>
        </div>

        {/* Questions */}
        <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
          {Object.entries(groupedQuestions).map(([type, qs]) => (
            <div key={type} style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:'12px',padding:'1.5rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'1.25rem',paddingBottom:'0.75rem',borderBottom:'1px solid #F3F4F6'}}>
                <span style={{background:'#DBEAFE',color:'#1D4ED8',fontSize:'12px',fontWeight:'500',padding:'3px 10px',borderRadius:'9999px'}}>{typeLabels[type] || type}</span>
                <span style={{fontSize:'14px',color:'#6B7280'}}>{qs.length} question{qs.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
                {qs.map((q: any, i: number) => {
                  const globalIdx = questionIndices[type][i]
                  const isRevealed = !!revealedAnswers[globalIdx]
                  return (
                    <div key={i} style={{borderBottom:'1px solid #F9FAFB',paddingBottom:'1.25rem'}}>
                      <p style={{fontSize:'15px',fontWeight:'500',color:'#1F2937',marginBottom:'0.5rem'}}>{i + 1}. {q.question}</p>
                      {q.options && (
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'0.75rem'}}>
                          {q.options.map((opt: string, oi: number) => (
                            <p key={oi} style={{fontSize:'13px',color:'#4B5563',background:'#F9FAFB',padding:'6px 10px',borderRadius:'6px'}}>{opt}</p>
                          ))}
                        </div>
                      )}
                      {isRevealed ? (
                        <div style={{background:'#F0FDF4',border:'1px solid #DCFCE7',borderRadius:'8px',padding:'10px 14px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px'}}>
                          <p style={{fontSize:'13px',color:'#166534'}}><strong>Answer:</strong> {q.answer}</p>
                          <button onClick={() => toggleAnswer(String(globalIdx))}
                            style={{background:'none',border:'none',color:'#6B7280',fontSize:'12px',cursor:'pointer',flexShrink:0,padding:'0'}}>Hide</button>
                        </div>
                      ) : (
                        <button onClick={() => toggleAnswer(String(globalIdx))}
                          style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',color:'#374151',cursor:'pointer',fontWeight:'500',width:'100%',textAlign:'left'}}>
                          👁 Show answer
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
