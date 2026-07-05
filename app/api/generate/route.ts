import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { images, subject, classLevel, questionTypes, userId } = await req.json()

    if (!images || images.length === 0) return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    if (images.length > 15) return NextResponse.json({ error: 'Maximum 15 pages allowed' }, { status: 400 })

    // Check user profile and pages
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles').select('*').eq('id', userId).single()

    if (profileError || !profile) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    // Check if monthly reset needed (30 days)
    const resetAt = new Date(profile.pages_reset_at)
    const now = new Date()
    const diffDays = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays >= 30) {
      await supabaseAdmin.from('profiles').update({ pages_used: 0, pages_reset_at: now.toISOString() }).eq('id', userId)
      profile.pages_used = 0
    }

    const planLimits: Record<string, number> = { free: 10, scholar: 200, topper: 500, champion: 800 }
    const limit = planLimits[profile.plan] || 10
    if ((profile.pages_used || 0) + images.length > limit) {
      return NextResponse.json({ error: `Page limit exceeded. You have ${limit - profile.pages_used} pages remaining.` }, { status: 400 })
    }

    // Build prompt
    const qtList = questionTypes.map((qt: any) => `- ${qt.count} ${qt.label} questions`).join('\n')
    const isMaths = ['maths', 'math', 'mathematics', 'ganit'].includes((subject || '').toLowerCase().trim())

    const systemPrompt = `You are an expert Indian school teacher creating revision questions. 
Generate questions appropriate for Class ${classLevel} students (aged ${classLevel + 5}-${classLevel + 6} years).
${isMaths ? 'This is a Maths chapter. Focus on numerical problems, calculations, and problem-solving. Use actual numbers and equations from the textbook pages.' : 'For Critical Thinking questions, create open-ended questions requiring reasoning beyond the text.'}
Return ONLY valid JSON. No markdown, no backticks, no explanation.`

    const userPrompt = `Based on these textbook pages${subject ? ` (${subject})` : ''}, generate for Class ${classLevel}:

${qtList}

Return ONLY this JSON structure:
{
  "title": "chapter topic",
  "questions": [
    {"type": "mcq", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A) ..."},
    {"type": "fill", "question": "The ___ is ...", "answer": "..."},
    {"type": "truefalse", "question": "...", "answer": "True"},
    {"type": "oneword", "question": "...", "answer": "..."},
    {"type": "short", "question": "...", "answer": "2-3 line answer"},
    {"type": "long", "question": "...", "answer": "detailed answer"},
    {"type": "match", "question": "Match: Column A vs Column B", "answer": "1-b, 2-a, 3-d"},
    {"type": "define", "question": "Define ...", "answer": "..."},
    {"type": "critical", "question": "Why/How/What if ...", "answer": "reasoning answer"}
  ]
}`

    // Build image content blocks — limit to first 10 images to avoid timeout
    const imagesToProcess = images.slice(0, 10)
    const imageBlocks = imagesToProcess.map((base64: string) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 }
    }))

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: userPrompt }]
      }]
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    
    // Clean and parse JSON
    let cleanText = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    
    // Find JSON object in case there's any surrounding text
    const jsonStart = cleanText.indexOf('{')
    const jsonEnd = cleanText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanText = cleanText.substring(jsonStart, jsonEnd + 1)
    }

    const parsed = JSON.parse(cleanText)

    // Save to DB
    const { data: questionSet } = await supabaseAdmin.from('question_sets').insert({
      user_id: userId,
      subject: subject || parsed.title || 'General',
      class_level: classLevel,
      pages_used: images.length,
      question_types: questionTypes,
      questions: parsed.questions
    }).select().single()

    // Update pages used
    await supabaseAdmin.from('profiles').update({
      pages_used: (profile.pages_used || 0) + images.length
    }).eq('id', userId)

    return NextResponse.json({ setId: questionSet.id, success: true })
  } catch (err: any) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: err.message || 'Generation failed. Please try with fewer pages or question types.' }, { status: 500 })
  }
}
