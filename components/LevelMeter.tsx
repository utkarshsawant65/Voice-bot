const BARS = 36;

// Audio meter under the portrait: follows the mic while listening and the voice while speaking
export default function LevelMeter({ level, live, color }: { level: number; live: boolean; color: string }) {
  return (
    <div className="flex h-10 w-full items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => {
        const wave = Math.abs(Math.sin(i * 1.7 + level * 14));
        const height = live ? Math.min(1, 0.1 + level * (0.35 + 0.65 * wave)) : 0.1;
        return (
          <span
            key={i}
            className="flex-1 rounded-full transition-[height] duration-75"
            style={{ height: `${height * 100}%`, background: color, opacity: live ? 0.9 : 0.35 }}
          />
        );
      })}
    </div>
  );
}
