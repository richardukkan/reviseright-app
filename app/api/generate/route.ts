import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

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
    const systemPrompt = `You are an expert teacher creating revision questions for Indian school students. 
Generate questions that are age-appropriate for Class ${classLevel} students (aged ${classLevel + 5}-${classLevel + 6} years).
For Critical Thinking questions, create open-ended questions that require reasoning beyond what is directly stated in the text.
Format your response as valid JSON only, with no markdown or extra text.`

    const userPrompt = `Based on the textbook pages provided${subject ? ` about ${subject}` : ''}, generate the following revision questions for a Class ${classLevel} student:

${qtList}

Return ONLY a JSON object in this exact format:
{
  "title": "Chapter title or topic name",
  "questions": [
    {
      "type": "mcq",
      "question": "Question text",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "answer": "B) option2"
    },
    {
      "type": "fill",
      "question": "The ___ is responsible for photosynthesis.",
      "answer": "chloroplast"
    },
    {
      "type": "truefalse",
      "question": "Statement here.",
      "answer": "True"
    },
    {
      "type": "short",
      "question": "Question?",
      "answer": "Answer in 2-3 lines."
    },
    {
      "type": "long",
      "question": "Question?",
      "answer": "Detailed answer in 6-8 lines."
    },
    {
      "type": "critical",
      "question": "Open-ended thinking question?",
      "answer": "Model answer with reasoning."
    }
  ]
}`

    // Build image content blocks
    const imageBlocks = images.map((base64: string) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 }
    }))

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: userPrompt }]
      }]
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleanText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 })
  }
}
