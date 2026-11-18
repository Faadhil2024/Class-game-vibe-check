import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
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

export function StudentWelcome({
  session,
  urlJoinCode,
  existingStudent,
  onJoin,
  onViewResults,
  joining,
  error,
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

  if (existingStudent && existingStudent.status === 'Completed') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>Already submitted</span>
            {session && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-500">{session.joinCode}</span>
              </>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Welcome back, {existingStudent.name}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            You&apos;ve already completed all 10 questions for this classroom session. Jump straight into the live class results to see how everyone voted.
          </p>

          <div className="mt-8">
            <button
              type="button"
              onClick={onViewResults}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              <span>VIEW CLASS RESULTS</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-12"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span className="text-indigo-600 font-semibold">Live Classroom Poll</span>
          <span aria-hidden="true">·</span>
          <span>{session ? session.label : 'Connecting to active session...'}</span>
          {(urlJoinCode || session?.joinCode) && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">
                Code {urlJoinCode || session?.joinCode}
              </span>
            </>
          )}
        </div>

        <h1 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          The Class Vibe Check
        </h1>

        <p className="mt-3 text-xl font-semibold text-slate-800 sm:text-2xl">
          Let&apos;s see how our class really thinks 👀
        </p>

        <p className="mt-2.5 text-base text-slate-600">
          10 questions. No wrong answers. Just vibes.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="student-name"
              className="block text-sm font-semibold text-slate-800"
            >
              Your first name or preferred display name
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
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
                className="w-full flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={joining}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-bold tracking-wide text-white transition-all hover:bg-indigo-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <span>{joining ? 'Joining...' : 'JOIN'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {displayError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
            >
              {displayError}
            </div>
          )}
        </form>

        <div className="mt-8 border-t border-slate-100 pt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
            Answers save automatically
          </span>
          <span aria-hidden="true">·</span>
          <span>Individual choices stay private from classmates</span>
          <span aria-hidden="true">·</span>
          <span>Takes ~60 seconds</span>
        </div>
      </motion.div>
    </div>
  );
}
