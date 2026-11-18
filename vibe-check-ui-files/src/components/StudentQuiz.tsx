import { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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

export function StudentQuiz({
  student,
  initialIndex,
  onSelectAnswer,
  onComplete,
  saving,
  completing,
  error,
}: StudentQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(initialIndex, 0), POLL_QUESTIONS.length - 1)
  );
  const [direction, setDirection] = useState<1 | -1>(1);
  const [reaction, setReaction] = useState<{ text: string; key: number } | null>(null);
  const lastReactionRef = useRef<string | null>(null);

  const question = POLL_QUESTIONS[currentIndex];
  const selectedChoice = student.answers[question.id];
  const totalQuestions = POLL_QUESTIONS.length;
  const allAnswered = POLL_QUESTIONS.every(
    (q) => student.answers[q.id] === 'A' || student.answers[q.id] === 'B'
  );
  const isLast = currentIndex === totalQuestions - 1;
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  const pickRandomReaction = () => {
    const pool = PLAYFUL_REACTIONS.filter((r) => r !== lastReactionRef.current);
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? PLAYFUL_REACTIONS[0];
    lastReactionRef.current = chosen;
    setReaction({ text: chosen, key: Date.now() });
  };

  const handleChoose = async (choice: AnswerChoice) => {
    pickRandomReaction();
    await onSelectAnswer(question.id, choice);
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setReaction(null);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = async () => {
    if (!selectedChoice) return;
    if (!isLast) {
      setDirection(1);
      setReaction(null);
      setCurrentIndex((prev) => prev + 1);
      return;
    }
    if (!allAnswered) {
      const firstMissing = POLL_QUESTIONS.findIndex(
        (q) => student.answers[q.id] !== 'A' && student.answers[q.id] !== 'B'
      );
      if (firstMissing !== -1) {
        setDirection(-1);
        setReaction(null);
        setCurrentIndex(firstMissing);
      }
      return;
    }
    await onComplete();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-3xl flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm font-medium text-slate-600">
          <span>
            Answering as <strong className="font-semibold text-slate-900">{student.name}</strong>
          </span>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Saving
              </span>
            )}
            <span className="font-mono text-sm font-semibold tabular-nums text-indigo-600">
              {currentIndex + 1}/{totalQuestions}
            </span>
          </div>
        </div>

        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
        >
          <motion.div
            className="h-full rounded-full bg-indigo-600"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={question.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Question {question.number} of {totalQuestions}
            </div>

            <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {question.prompt}
            </h2>

            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { key: 'A' as const, label: question.optionA },
                  { key: 'B' as const, label: question.optionB },
                ] as const
              ).map((opt) => {
                const isSelected = selectedChoice === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleChoose(opt.key)}
                    aria-pressed={isSelected}
                    className={`group relative flex min-h-[120px] flex-col justify-between rounded-xl border-2 p-6 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.99] ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}
                      >
                        {opt.key}
                      </span>
                      {isSelected && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    <span
                      className={`mt-4 text-lg font-semibold leading-snug ${
                        isSelected ? 'text-indigo-950' : 'text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 min-h-[38px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {reaction && (
              <motion.div
                key={reaction.key}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-900"
              >
                {reaction.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0 || completing}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>BACK</span>
          </button>

          <div className="hidden items-center gap-1.5 sm:flex" aria-label="Question progress dots">
            {POLL_QUESTIONS.map((q, idx) => {
              const answered = Boolean(student.answers[q.id]);
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setReaction(null);
                    setCurrentIndex(idx);
                  }}
                  title={`Question ${q.number}`}
                  aria-label={`Go to question ${q.number}`}
                  className={`h-2.5 rounded-full transition-all ${
                    isCurrent
                      ? 'w-6 bg-indigo-600'
                      : answered
                      ? 'w-2.5 bg-teal-500 hover:bg-teal-600'
                      : 'w-2.5 bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={!selectedChoice || completing}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {completing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>SUBMITTING...</span>
              </>
            ) : isLast ? (
              <>
                <span>FINISH</span>
                <Check className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                <span>NEXT</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
