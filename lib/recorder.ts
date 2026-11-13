const CALIBRATE_MS = 400;
const SILENCE_MS = 1300;
const NO_SPEECH_MS = 9000;
const MAX_MS = 30000;
const TICK_MS = 100;

// Records the mic. Calls onAutoStop after silence, no speech, or the max length. onLevel drives the live meter.
export async function startRecording(onAutoStop: () => void, onLevel: (level: number) => void = () => {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  // Chrome/Firefox record webm, Safari records mp4
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start();

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  const startedAt = Date.now();
  let noise = 0;
  let threshold = 0.02;
  let lastVoiceAt = 0;
  let voicedMs = 0;

  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length);
    const now = Date.now();
    const elapsed = now - startedAt;
    onLevel(Math.min(1, rms * 5));

    // Measure the room first, so the voice threshold adapts to background noise
    if (elapsed < CALIBRATE_MS) {
      noise = Math.max(noise, rms);
      threshold = Math.min(0.08, Math.max(0.02, noise * 2.5));
      return;
    }
    if (rms > threshold) {
      voicedMs += TICK_MS;
      lastVoiceAt = now;
    }
    const doneSpeaking = lastVoiceAt > 0 && now - lastVoiceAt > SILENCE_MS;
    const neverSpoke = lastVoiceAt === 0 && elapsed > NO_SPEECH_MS;
    if (doneSpeaking || neverSpoke || elapsed > MAX_MS) {
      clearInterval(timer);
      onAutoStop();
    }
  }, TICK_MS);

  return {
    // voicedMs lets the caller skip sending clicks, coughs and silence
    stop: () =>
      new Promise<{ blob: Blob; voicedMs: number }>((resolve) => {
        clearInterval(timer);
        onLevel(0);
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          ctx.close();
          resolve({ blob: new Blob(chunks, { type: recorder.mimeType }), voicedMs });
        };
        recorder.stop();
      }),
  };
}
