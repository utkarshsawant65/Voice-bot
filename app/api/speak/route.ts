import { isRateLimited } from "@/lib/rateLimit";

// Any failure returns 503 and the browser falls back to its own voice
export async function POST(req: Request) {
  const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID || isRateLimited(req, "speak")) {
    return new Response(null, { status: 503 });
  }

  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim()) return new Response(null, { status: 400 });

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 1500), model_id: "eleven_flash_v2_5" }),
      },
    );
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (err) {
    console.error("speak failed", err);
    return new Response(null, { status: 503 });
  }
}
