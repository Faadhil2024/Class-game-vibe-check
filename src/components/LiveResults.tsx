import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react';
import { POLL_QUESTIONS, type PublicLiveResults } from '../shared/questions.ts';

interface LiveResultsProps {
  onSessionReset?: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;
const INK = '#0B0B0F';
type Q = (typeof POLL_QUESTIONS)[number];

function Num({ value, active = true }: { value: number; active?: boolean }) {
  const mv = useMotionValue(0);
  const sp = useSpring(mv, { stiffness: 90, damping: 20 });
  const txt = useTransform(sp, (v) => String(Math.round(v)));
  useEffect(() => { mv.set(active ? value : 0); }, [value, active, mv]);
  return <motion.span>{txt}</motion.span>;
}

function QuestionBlock({ q, agg }: { q: Q; agg?: PublicLiveResults['questions'][number] }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { amount: 0.1, once: true });
  const pa = agg?.percentA ?? 0;
  const pb = agg?.percentB ?? 0;
  const ca = agg?.countA ?? 0;
  const cb = agg?.countB ?? 0;
  const votes = agg?.totalVotes ?? 0;
  const lead = votes === 0 || pa === pb ? null : pa > pb ? 'A' : 'B';

  return (
    <section ref={ref} className="mt-24 sm:mt-36">
      <div className="flex items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.25em]">
        <span className="text-indigo-400">Q{String(q.number).padStart(2, '0')}</span>
        <span className="tabular-nums text-slate-500">{votes} {votes === 1 ? 'vote' : 'votes'}</span>
      </div>
      <h2 className="mt-4 text-balance text-4xl font-semibold text-slate-950 sm:text-7xl">
        {q.prompt}
      </h2>

      <div className="mt-8 flex h-28 w-full gap-1.5 overflow-hidden rounded-[2rem] border border-slate-200 bg-[#14141d] sm:h-52">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: seen ? `${pa}%` : '0%' }}
          transition={{ duration: 1, ease: EASE }}
          className="flex min-w-0 items-center overflow-hidden rounded-[2rem]"
          style={{ background: '#FF4D2E', color: INK }}
        >
          <span className="whitespace-nowrap px-5 font-display text-3xl font-semibold tabular-nums sm:px-10 sm:text-7xl lg:text-8xl">
            <Num value={pa} active={seen} />%
          </span>
        </motion.div>
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: seen ? `${pb}%` : '0%' }}
          transition={{ duration: 1, ease: EASE }}
          className="flex min-w-0 items-center justify-end overflow-hidden rounded-[2rem]"
          style={{ background: '#C6F432', color: INK }}
        >
          <span className="whitespace-nowrap px-5 font-display text-3xl font-semibold tabular-nums sm:px-10 sm:text-7xl lg:text-8xl">
            <Num value={pb} active={seen} />%
          </span>
        </motion.div>
      </div>

      <div className="mt-4 flex justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-lg font-bold text-slate-900 sm:text-2xl">
            <span className="truncate">{q.optionA}</span>
            {lead === 'A' && <span className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-50">Leading</span>}
          </div>
          <div className="font-mono text-sm tabular-nums text-slate-500">{ca} {ca === 1 ? 'vote' : 'votes'}</div>
        </div>
        <div className="min-w-0 text-right">
          <div className="flex items-center justify-end gap-2 text-lg font-bold text-slate-900 sm:text-2xl">
            {lead === 'B' && <span className="shrink-0 rounded-full bg-teal-700 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-50">Leading</span>}
            <span className="truncate">{q.optionB}</span>
          </div>
          <div className="font-mono text-sm tabular-nums text-slate-500">{cb} {cb === 1 ? 'vote' : 'votes'}</div>
        </div>
      </div>
    </section>
  );
}

export function LiveResults({ onSessionReset }: LiveResultsProps) {
  const [results, setResults] = useState<PublicLiveResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSessionSignature = useRef<string | null>(null);

  useEffect(() => {
    let closed = false;
    let inFlight = false;

    const fetchResults = async () => {
      if (closed || inFlight) return;
      inFlight = true;
      try {
        const res = await fetch('/api/results/live', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const parsed = (await res.json()) as PublicLiveResults;
        if (closed) return;

        const nextSignature = `${parsed.session.id}:${parsed.session.createdAt}`;
        if (
          lastSessionSignature.current !== null &&
          lastSessionSignature.current !== nextSignature
        ) {
          onSessionReset?.();
        }
        lastSessionSignature.current = nextSignature;

        setResults(parsed);
        setError(null);
      } catch {
        if (!closed) {
          setError('Reconnecting to live results...');
        }
      } finally {
        inFlight = false;
      }
    };

    void fetchResults();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchResults();
      }
    }, 3000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchResults();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      closed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onSessionReset]);

  if (!results) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-6 h-24 w-3/4 animate-pulse rounded-3xl bg-slate-200" />
        <div className="mt-12 h-52 animate-pulse rounded-[2rem] bg-slate-100" />
      </div>
    );
  }

  const stats = [
    { label: 'Joined', value: results.totalJoined, tone: 'text-slate-900' },
    { label: 'Completed', value: results.completedCount, tone: 'text-teal-700' },
    { label: 'Still answering', value: results.stillAnsweringCount, tone: 'text-indigo-600' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-10 sm:px-6 sm:pt-16">
      <h1 className="text-balance text-5xl font-semibold sm:text-7xl lg:text-9xl">How the class thinks.</h1>
      <p className="mt-6 max-w-xl text-lg text-slate-600">Votes land the moment classmates finish. Individual choices stay private.</p>

      {error && <div role="status" className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-950/50 px-4 py-2.5 text-sm font-medium text-amber-200">{error}</div>}

      <div className="mt-14 grid grid-cols-3 gap-4 sm:gap-8">
        {stats.map((s) => (
          <div key={s.label}>
            <div className={`font-display text-5xl font-semibold tabular-nums sm:text-7xl lg:text-9xl ${s.tone}`}><Num value={s.value} /></div>
            <div className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {results.completedCount === 0 && (
        <div className="mt-14 rounded-[2rem] border border-dashed border-slate-300 p-10 text-center">
          <p className="font-display text-3xl font-semibold text-slate-900">Waiting for the first finisher</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Splits fill in as soon as someone submits all {POLL_QUESTIONS.length} questions. Keep this tab open.</p>
        </div>
      )}

      {POLL_QUESTIONS.map((q) => (
        <QuestionBlock key={q.id} q={q} agg={results.questions.find((i) => i.questionId === q.id)} />
      ))}
    </div>
  );
}