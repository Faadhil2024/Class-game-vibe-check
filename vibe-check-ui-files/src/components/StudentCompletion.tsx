import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { StudentSelfState } from '../shared/questions.ts';

interface StudentCompletionProps {
  student: StudentSelfState;
  onViewResults: () => void;
}

export function StudentCompletion({ student, onViewResults }: StudentCompletionProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          You&apos;re officially part of the vibe check! 🎉
        </h1>

        <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
          Thanks for participating. Let&apos;s see what the class thinks.
        </p>

        <div className="mx-auto mt-7 flex max-w-md flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-left">
            <div className="text-xs font-medium text-slate-500">Participant</div>
            <div className="text-base font-bold text-slate-900">{student.name}</div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs font-medium text-slate-500">Status</div>
            <div className="font-mono text-sm font-semibold text-teal-700 tabular-nums">
              10/10 Completed
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={onViewResults}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-bold tracking-wide text-white transition-all hover:bg-indigo-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            <span>VIEW CLASS RESULTS</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
