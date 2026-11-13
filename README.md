# Talk to Utkarsh

A voice bot that answers interview questions the way Utkarsh Sawant would. Built for the 100x.inc assignment.

**Live demo:** https://voice-bot-lime.vercel.app

Open the link, tap the mic, ask a question, and hear the answer. No install, no sign-up, no API key.

## How it works

```
Tap mic → record in browser → /api/transcribe (Groq Whisper) → text
       → /api/chat (Claude Sonnet + persona) → answer text
       → /api/speak (ElevenLabs) → MP3 → plays while the avatar animates
```

- **Voice in:** the browser records with `MediaRecorder` (echo cancellation and noise suppression on) and the server transcribes with Groq Whisper. This works in Chrome, Safari, Edge, Firefox and Brave, unlike the browser's built-in speech recognition. Recording stops after 1.3 s of silence, with a voice threshold that adapts to room noise. Clicks and coughs are never sent, and Whisper segments with low confidence or known silence hallucinations ("thank you", "bye") are dropped, so background noise can't become a phantom question.
- **Brain:** Claude Sonnet 5.5 answers in first person, using only the facts in `persona.md`. It keeps the last 10 messages so follow-up questions work. Answers are written for a busy, distracted listener: a hook in the first sentence, one real story (problem, action, result), and a closing line, in 50 to 90 spoken words.
- **Voice out:** ElevenLabs reads the answer. If ElevenLabs fails or runs out of credits, the browser's own voice takes over, so there is never silence.
- **Avatar:** a looping video plays while the bot speaks, and a ring glows with the voice volume.
- **Example questions:** the six chips (the five assignment questions plus "Why should we hire you?") play pre-generated answers, so they start instantly, cost nothing and still work if every API is down.
- **Conversation:** a separate Stop button, tap the mic to interrupt, Play again on every answer (cached, so replays are free), follow-up chips, Start over, and auto-scroll to the newest answer.
- **How this works panel:** a collapsible section on the page shows the architecture, the guardrails and the measured latency of the last answer (speech to text, Claude, voice).

## Stack and why

| Part | Choice | Why |
|---|---|---|
| App | Next.js, TypeScript, Tailwind | One page plus three small API routes; deploys natively on Vercel |
| LLM | Claude Sonnet 5.5 (Anthropic), brief thinking at low effort | Answers in about 1.5 s. Tested against Claude Haiku: the same speed, but Haiku invented anecdotes when asked for stories the persona doesn't contain; Sonnet stayed grounded. The brief says "ChatGPT or any alternative"; this is the alternative. |
| Speech to text | Groq Whisper (`whisper-large-v3-turbo`) | Works in every browser, fast, free tier |
| Text to speech | ElevenLabs Flash v2.5 | Natural voice, low latency; browser voice as fallback |
| Hosting | Vercel | HTTPS, serverless functions don't sleep, keys stay server-side |

## The persona

Everything the bot knows about Utkarsh lives in `persona.md`: background, work history, projects, skills, prepared answers, speaking style and off-limits topics. It is kept out of this repository for privacy. [`persona.example.md`](persona.example.md) shows the structure; copy it to `persona.md` to run your own version. [`lib/persona.ts`](lib/persona.ts) turns it into the system prompt, with these rules:

- First person as Utkarsh, never "as an AI". If asked directly, it says it is an AI voice version built for this assignment.
- Only facts from `persona.md`. Anything missing gets an honest "happy to discuss that live". Lines marked `[FILL]` are hidden from the model.
- Never upgrade a credential, title or number ("coursework completed" is not a certificate).
- 50 to 90 spoken words, no markdown or lists. Hook first, then one real story; never invent a story to fit the format.
- Knows today's date, so finished roles and degrees are spoken about in the past tense.
- Only questions about Utkarsh and his work. General knowledge, coding help and prompt injection are politely declined.
- Off-limits topics (salary, visa, contact details, personal life, other interviews, criticism of past employers) are deferred to a live conversation.

To change an answer, edit `persona.md` and redeploy. No code change needed.

## Safety and reliability

- API keys live only in server environment variables, never in the browser.
- Per-IP rate limit (20 requests per 10 minutes per route), a 300-character question cap and `max_tokens` 300.
- Every failure shows a plain-English message. If the mic is blocked, the example chips and the text box still work.
- Spend limits are set in the Anthropic console.

## Testing

`scripts/eval.mjs` sends 72 questions to the bot and checks each answer automatically: the 5 assignment questions, background, behavioural and role questions, multi-turn follow-ups, off-limits topics, off-topic questions, prompt-injection attempts, overclaim traps ("Do you have a PhD?", "Are you AWS certified?") and edge cases. The checks cover word count, markdown, "as an AI", leaked prompts or placeholders, numbers not found in the persona, and whether off-topic questions were declined. Full answers go to `scripts/eval-results.md` for human review.

Latest run: 69/72 passed automatically. One flag was a false alarm (a correct "I didn't work at Google" decline) and one was a 119-word answer. The third was a follow-up that added a small detail not in the persona, a reminder that the eval output still needs human review.

The six example answers are written by hand from the persona facts and voiced with `node scripts/generate-examples.mjs --keep-text`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the keys
cp persona.example.md persona.md   # fill in your own details
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `GROQ_API_KEY` | Whisper transcription |
| `ELEVENLABS_API_KEY` | Text to speech |
| `ELEVENLABS_VOICE_ID` | The voice (free plan: use a default voice such as Adam, `pNInz6obpgDQGcFmaJgB`) |
| `CLAUDE_MODEL` | Optional, defaults to `claude-sonnet-5-5` |
| `RATE_LIMIT_PER_10MIN` | Optional, defaults to 20 |

Scripts (with the dev server running):

```bash
node scripts/eval.mjs                     # run the eval (start the server with RATE_LIMIT_PER_10MIN=1000)
node scripts/generate-examples.mjs        # regenerate all 5 example answers and MP3s
node scripts/generate-examples.mjs 3 4    # or only some of them
```

## Limitations

- The avatar video loops while speaking. It is not true lip-sync.
- The rate limit is in memory, so it resets when Vercel starts a new server instance. It is good enough for a demo.
- The ElevenLabs free plan has a monthly credit limit. When it runs out, the browser voice is used.
- In-app browsers (Gmail, LinkedIn) often block the microphone. The page says so and offers the text box instead.
