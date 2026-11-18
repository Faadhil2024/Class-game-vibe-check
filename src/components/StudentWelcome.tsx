import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { SessionPublicInfo, StudentSelfState } from '../shared/questions.ts';

interface StudentWelcomeProps {
  session: SessionPublicInfo | null;
  urlJoinCode: string | null;
  existingStudent: StudentSelfState | null;
  onJoin: (name: string) => Promise<void>;
  onViewResults: () => void;
  joining: boolean;
  error: string | null;
}

const EASE = [0.23, 1, 0.32, 1] as const;

function Line({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span className="block" initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: EASE, delay }}>
        {text}
      </motion.span>
    </span>
  );
}

export function StudentWelcome({
  session, urlJoinCode, existingStudent, onJoin, onViewResults, joining, error,
}: StudentWelcomeProps) {
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) {
      setLocalError('Please enter your first name or display name to join.');
      return;
    }
    if (cleaned.length > 40) {
      setLocalError('Please keep your display name under 40 characters.');
      return;
    }
    setLocalError(null);
    await onJoin(cleaned);
  };

  const code = urlJoinCode || session?.joinCode;

  if (existingStudent && existingStudent.status === 'Completed') {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-57px)] max-w-5xl flex-col justify-center px-4 py-12 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-teal-700">Already submitted{code ? ` · ${code}` : ''}</div>
        <h1 className="mt-5 text-balance text-6xl font-semibold sm:text-9xl">Welcome back, {existingStudent.name}.</h1>
        <p className="mt-6 max-w-lg text-lg text-slate-600">You finished all 10 questions. Jump into the live class results.</p>
        <motion.button
          type="button"
          onClick={onViewResults}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.96 }}
          className="mt-10 inline-flex min-h-[64px] w-fit items-center gap-3 rounded-full px-10 text-lg font-bold"
          style={{ background: '#FF4D2E', color: '#0B0B0F' }}
        >
          <span>See class results</span>
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <div className="relative mx-auto flex min-h-[calc(100svh-57px)] max-w-6xl flex-col justify-center overflow-hidden px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        <span className="text-indigo-600">Live classroom poll</span>
        <span>{session ? session.label : 'Connecting...'}</span>
        {code && <span className="text-slate-900">Code {code}</span>}
      </div>

      <h1 className="mt-6 text-[14vw] font-semibold leading-[0.88] sm:text-[11vw] lg:text-[9.5rem]">
        <Line text="The Class" />
        <Line text="Vibe Check." delay={0.1} />
      </h1>

      <div className="pointer-events-none absolute right-4 top-24 hidden gap-4 sm:flex lg:right-10" aria-hidden="true">
        {[['Tabs', '#FF4D2E', -7], ['Spaces', '#C6F432', 6]].map(([t, c, r], i) => (
          <motion.div
            key={t as string}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: [0, -12, 0] }}
            transition={{ opacity: { delay: 0.5 + i * 0.15 }, y: { duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 } }}
            className="rounded-full px-6 py-3 font-display text-2xl font-semibold"
            style={{ background: c as string, color: '#0B0B0F', rotate: `${r}deg` }}
          >
            {t}
          </motion.div>
        ))}
      </div>

      <p className="mt-8 max-w-md text-xl text-slate-700">10 questions. No wrong answers. Just vibes.</p>

      <form onSubmit={handleSubmit} className="mt-10 max-w-2xl">
        <label htmlFor="student-name" className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Your name or nickname
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="student-name"
            type="text"
            autoFocus
            autoComplete="given-name"
            maxLength={40}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (localError) setLocalError(null);
            }}
            placeholder="e.g. Alex"
            disabled={joining}
            className="min-h-[64px] w-full flex-1 rounded-full border-2 border-slate-300 bg-slate-100 px-7 text-2xl font-semibold text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-700 focus:outline-none disabled:opacity-60"
          />
          <motion.button
            type="submit"
            disabled={joining}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex min-h-[64px] shrink-0 items-center justify-center gap-3 rounded-full px-10 text-lg font-bold disabled:opacity-60"
            style={{ background: '#C6F432', color: '#0B0B0F' }}
          >
            <span>{joining ? 'Joining...' : 'Join'}</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </motion.button>
        </div>
        {displayError && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm font-medium text-rose-200"
          >
            {displayError}
          </motion.div>
        )}
        <p className="mt-5 text-sm text-slate-500">Answers save automatically · Your choices stay private · About 60 seconds</p>
      </form>
    </div>
  );
}