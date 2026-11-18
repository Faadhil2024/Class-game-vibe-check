import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import {
  PLAYFUL_REACTIONS,
  POLL_QUESTIONS,
  type AnswerChoice,
  type StudentSelfState,
} from '../shared/questions.ts';

interface StudentQuizProps {
  student: StudentSelfState;
  initialIndex: number;
  onSelectAnswer: (questionId: string, choice: AnswerChoice) => Promise<void>;
  onComplete: () => Promise<void>;
  saving: boolean;
  completing: boolean;
  error: string | null;
}

const EASE = [0.23, 1, 0.32, 1] as const;
const COLOR = { A: '#FF4D2E', B: '#C6F432' } as const;
const INK = '#0B0B0F';
type Pop = { id: number; qid: string; choice: AnswerChoice; x: number; y: number };

export function StudentQuiz({
  student,
  initialIndex,
  onSelectAnswer,
  onComplete,
  saving,
  completing,
  error,
}: StudentQuizProps) {
  const total = POLL_QUESTIONS.length;
  const [active, setActive] = useState(Math.min(Math.max(initialIndex, 0), total - 1));
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [origins, setOrigins] = useState<Record<string, { x: number; y: number }>>({});
  const [pops, setPops] = useState<Pop[]>([]);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const lastReaction = useRef<string | null>(null);

  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });

  const isAnswered = (id: string) => student.answers[id] === 'A' || student.answers[id] === 'B';
  const missing = POLL_QUESTIONS.filter((q) => !isAnswered(q.id));
  const answeredCount = total - missing.length;
  const goTo = (i: number) => refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    document.documentElement.classList.add('snap-y-prox');
    return () => document.documentElement.classList.remove('snap-y-prox');
  }, []);

  useEffect(() => {
    if (initialIndex > 0) {
      refs.current[Math.min(initialIndex, total)]?.scrollIntoView({ block: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const choose = async (idx: number, choice: AnswerChoice, e: MouseEvent<HTMLButtonElement>) => {
    const q = POLL_QUESTIONS[idx];
    const r = e.currentTarget.getBoundingClientRect();
    const keyboard = e.detail === 0;
    const x = keyboard ? 50 : ((e.clientX - r.left) / r.width) * 100;
    const y = keyboard ? 50 : ((e.clientY - r.top) / r.height) * 100;
    const first = !isAnswered(q.id);
    const id = Date.now();
    setOrigins((o) => ({ ...o, [q.id + choice]: { x, y } }));
    setPops((p) => [...p, { id, qid: q.id, choice, x, y }]);
    setTimeout(() => setPops((p) => p.filter((i) => i.id !== id)), 900);
    const pool = PLAYFUL_REACTIONS.filter((t) => t !== lastReaction.current);
    const text = pool[Math.floor(Math.random() * pool.length)] ?? PLAYFUL_REACTIONS[0];
    lastReaction.current = text;
    setToast({ text, key: id });
    await onSelectAnswer(q.id, choice);
    if (first) setTimeout(() => goTo(idx + 1), 750);
  };

  const handleLockIn = async () => {
    if (completing) return;
    if (missing.length > 0) {
      goTo(POLL_QUESTIONS.indexOf(missing[0]));
      return;
    }
    await onComplete();
  };

  return (
    <div className="relative">
      <motion.div style={{ scaleX: bar }} className="fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-indigo-600" />

      <div className="sticky top-[57px] z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-slate-900 sm:block">{student.name}</span>
          <div
            className="flex flex-1 gap-1.5"
            role="progressbar"
            aria-valuenow={Math.min(active + 1, total)}
            aria-valuemin={1}
            aria-valuemax={total}
          >
            {POLL_QUESTIONS.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to question ${q.number}`}
                className="group flex-1 py-2"
              >
                <span
                  className={`block h-1.5 rounded-full transition-colors ${
                    i === active
                      ? 'bg-indigo-600'
                      : isAnswered(q.id)
                        ? 'bg-teal-700'
                        : 'bg-slate-300 group-hover:bg-slate-400'
                  }`}
                />
              </button>
            ))}
          </div>
          <span className="flex items-center gap-2 font-mono text-sm font-semibold tabular-nums text-slate-900">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" aria-label="Saving" />}
            {String(Math.min(active + 1, total)).padStart(2, '0')}
            <span className="text-slate-400">/{total}</span>
          </span>
        </div>
        {error && (
          <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/70 px-4 py-2 text-xs font-medium text-rose-200 sm:text-sm">
              {error}
            </div>
          </div>
        )}
      </div>

      {POLL_QUESTIONS.map((q, idx) => {
        const selected = student.answers[q.id];
        return (
          <motion.section
            key={q.id}
            ref={(el) => { refs.current[idx] = el; }}
            onViewportEnter={() => setActive(idx)}
            viewport={{ amount: 0.35 }}
            className="mx-auto flex min-h-[calc(100svh-110px)] max-w-6xl scroll-mt-[110px] snap-start flex-col justify-center px-4 py-10 sm:px-6"
          >
            <div className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-indigo-400">
              Question {String(q.number).padStart(2, '0')}
            </div>

            <h2 className="mt-4 text-balance text-5xl font-semibold text-slate-950 sm:text-7xl lg:text-8xl">
              {q.prompt}
            </h2>

            <div className="relative mt-10 grid grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5">
              {([['A', q.optionA], ['B', q.optionB]] as const).map(([key, label]) => {
                const on = selected === key;
                const o = origins[q.id + key];
                return (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={(e) => choose(idx, key, e)}
                    aria-pressed={on}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="relative flex min-h-[28svh] flex-col overflow-hidden rounded-[2rem] border-2 border-[#3c3c52] bg-[#1f1f2b] p-6 text-left transition-colors hover:border-[#68688a] hover:bg-[#262636] sm:min-h-[42svh] sm:p-8"
                    style={on ? { borderColor: COLOR[key] } : undefined}
                  >
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-0"
                          style={{ background: COLOR[key] }}
                          initial={o ? { clipPath: `circle(0% at ${o.x}% ${o.y}%)` } : false}
                          animate={{ clipPath: `circle(150% at ${o?.x ?? 50}% ${o?.y ?? 50}%)` }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.55, ease: EASE }}
                        />
                      )}
                    </AnimatePresence>

                    <span className="relative z-10 flex w-full shrink-0 items-center justify-between">
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl font-mono text-sm font-bold"
                        style={on ? { background: INK, color: COLOR[key] } : { background: COLOR[key] + '33', color: COLOR[key] }}
                      >
                        {key}
                      </span>
                      <AnimatePresence>
                        {on && (
                          <motion.span
                            initial={{ scale: 0.4, opacity: 0, rotate: -40 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0.4, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                            style={{ background: INK, color: COLOR[key] }}
                          >
                            <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span
                      className="relative z-10 flex w-full flex-1 items-center justify-center pb-6 text-center font-display text-4xl font-semibold leading-[0.98] tracking-tight sm:text-6xl"
                      style={{ color: on ? INK : '#FFFFFF' }}
                    >
                      {label}
                    </span>

                    {pops.filter((p) => p.qid === q.id && p.choice === key).map((p) => (
                      <span key={p.id} className="pointer-events-none absolute z-20" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                        {Array.from({ length: 14 }, (_, k) => {
                          const a = (k / 14) * Math.PI * 2;
                          const d = 70 + (k % 3) * 34;
                          return (
                            <motion.i
                              key={k}
                              className="absolute block h-2 w-2 rounded-full"
                              style={{ background: k % 2 ? INK : '#fff' }}
                              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                              animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0, opacity: 0 }}
                              transition={{ duration: 0.7, ease: EASE }}
                            />
                          );
                        })}
                      </span>
                    ))}
                  </motion.button>
                );
              })}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 z-30 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#484860] bg-[#14141d] font-mono text-xs font-bold tracking-wider text-slate-950 ring-8 ring-slate-50"
              >
                VS
              </div>
            </div>
          </motion.section>
        );
      })}

      <motion.section
        ref={(el) => { refs.current[total] = el; }}
        onViewportEnter={() => setActive(total - 1)}
        viewport={{ amount: 0.35 }}
        className="mx-auto flex min-h-[calc(100svh-110px)] max-w-6xl scroll-mt-[110px] snap-start flex-col justify-center px-4 py-10 sm:px-6"
      >
        <div className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-teal-700">The end</div>
        <h2 className="mt-4 text-balance text-5xl font-semibold text-slate-950 sm:text-7xl lg:text-8xl">
          {missing.length ? `${missing.length} left to go.` : `That's all ${total}.`}
        </h2>
        <p className="mt-6 max-w-xl text-lg text-slate-600">
          {missing.length
            ? `You have answered ${answeredCount} of ${total} questions. Finish the rest before locking in your answers.`
            : 'All 10 answers are saved. Lock them in now to unlock live class results.'}
        </p>
        {error && (
          <div role="alert" className="mt-6 max-w-xl rounded-2xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm font-medium text-rose-200">
            {error}
          </div>
        )}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <motion.button
            type="button"
            disabled={completing}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleLockIn}
            className="inline-flex min-h-[64px] w-fit items-center gap-3 rounded-full px-10 text-lg font-bold disabled:opacity-60"
            style={{ background: missing.length ? '#F4F1EA' : COLOR.B, color: INK }}
          >
            {completing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span>Locking in...</span>
              </>
            ) : missing.length ? (
              <span>Jump to Q{missing[0].number}</span>
            ) : (
              <>
                <span>Lock it in</span>
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </>
            )}
          </motion.button>
          <button
            type="button"
            disabled={completing}
            onClick={() => goTo(0)}
            className="inline-flex min-h-[64px] items-center rounded-full border border-slate-300 px-8 text-sm font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-950 disabled:opacity-50"
          >
            Review Q1–Q{total}
          </button>
        </div>
      </motion.section>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-slate-300 bg-slate-900 px-6 py-3 text-sm font-bold text-slate-50 shadow-xl"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}