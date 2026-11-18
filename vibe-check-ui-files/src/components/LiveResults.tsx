import { useEffect, useState } from 'react';
import { Radio, Users, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { POLL_QUESTIONS, type PublicLiveResults } from '../shared/questions.ts';

interface LiveResultsProps {
  onSessionReset?: () => void;
}

export function LiveResults({ onSessionReset }: LiveResultsProps) {
  const [results, setResults] = useState<PublicLiveResults | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let closed = false;
    const source = new EventSource('/api/stream/results');

    source.onopen = () => {
      if (!closed) {
        setConnected(true);
        setError(null);
      }
    };

    source.addEventListener('results', (event) => {
      if (closed) return;
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as PublicLiveResults;
        setResults(parsed);
        setConnected(true);
        setError(null);
      } catch {
        // Ignore malformed event
      }
    });

    source.addEventListener('session_reset', (event) => {
      if (closed) return;
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as PublicLiveResults;
        setResults(parsed);
      } catch {
        // Ignore
      }
      onSessionReset?.();
    });

    source.onerror = () => {
      if (!closed) {
        setConnected(false);
        setError('Reconnecting to live results stream...');
      }
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [onSessionReset]);

  if (!results) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-4 w-72 animate-pulse rounded bg-slate-100" />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-wider ${
                connected ? 'text-teal-700' : 'text-amber-700'
              }`}
            >
              <Radio
                className={`h-3.5 w-3.5 ${connected ? 'animate-pulse text-teal-600' : 'text-amber-600'}`}
                aria-hidden="true"
              />
              {connected ? 'LIVE' : 'RECONNECTING'}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-slate-500">{results.session.label}</span>
          </div>

          <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            How the Class Thinks
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Aggregated responses update automatically as classmates finish. Individual choices remain private.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500 tabular-nums">
          Last update {new Date(results.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {error && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800"
        >
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Students joined</span>
            <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {results.totalJoined}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-teal-700">
            {results.completedCount}/{results.totalJoined}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Still answering</span>
            <Clock className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-indigo-700">
            {results.stillAnsweringCount}
          </div>
        </div>
      </div>

      {results.completedCount === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">
            Waiting for the first completed submission
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Percentages appear here as soon as students submit all 10 questions. Keep this tab open to watch results evolve live.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {POLL_QUESTIONS.map((q) => {
          const agg = results.questions.find((item) => item.questionId === q.id);
          const countA = agg?.countA ?? 0;
          const countB = agg?.countB ?? 0;
          const percentA = agg?.percentA ?? 0;
          const percentB = agg?.percentB ?? 0;
          const totalVotes = agg?.totalVotes ?? 0;

          return (
            <section
              key={q.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                <span className="font-mono font-semibold text-indigo-600">Q{q.number}</span>
                <span className="font-mono tabular-nums">
                  {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                </span>
              </div>

              <h2 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
                {q.prompt}
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">{q.optionA}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-indigo-700 whitespace-nowrap shrink-0">
                      {countA} {countA === 1 ? 'vote' : 'votes'} ({percentA}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className="h-full rounded-full bg-indigo-600"
                      initial={false}
                      animate={{ width: `${percentA}%` }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">{q.optionB}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-teal-700 whitespace-nowrap shrink-0">
                      {countB} {countB === 1 ? 'vote' : 'votes'} ({percentB}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className="h-full rounded-full bg-teal-600"
                      initial={false}
                      animate={{ width: `${percentB}%` }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
