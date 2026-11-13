import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readLog } from "@/lib/log";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Q&A log", robots: { index: false, follow: false } };

// Private page: /logs?key=LOGS_SECRET. Anyone without the key gets a 404.
export default async function Logs({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (!process.env.LOGS_SECRET || key !== process.env.LOGS_SECRET) notFound();

  const rows = await readLog();
  const sessions = new Set(rows.map((r) => r.session)).size;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Q&A log</h1>
      <p className="mt-1 text-sm text-muted">
        {rows.length} questions from {sessions} visits, newest first. Times are in Berlin time.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-muted">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">Visit</th>
              <th className="p-3">Via</th>
              <th className="p-3">Where</th>
              <th className="p-3">Question</th>
              <th className="p-3">Answer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap p-3">
                  {new Date(r.time).toLocaleString("en-GB", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="p-3 font-mono text-xs">{r.session.slice(0, 6)}</td>
                <td className="p-3">{r.source}</td>
                <td className="whitespace-nowrap p-3">
                  {r.country} · {r.device}
                </td>
                <td className="min-w-48 p-3 font-medium">{r.question}</td>
                <td className="min-w-80 p-3 text-muted">{r.answer}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  No questions logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
