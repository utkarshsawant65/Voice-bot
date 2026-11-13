// Quick status check: which services are configured (never the keys themselves)
export function GET() {
  const env = process.env;
  return Response.json({
    ok: true,
    llm: Boolean(env.ANTHROPIC_API_KEY),
    speechToText: Boolean(env.GROQ_API_KEY),
    textToSpeech: Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID),
  });
}
