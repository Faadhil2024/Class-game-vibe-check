import { useState, type FormEvent } from 'react';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

interface TaLoginProps {
  onSuccess: (token: string) => void;
  onBackToPoll: () => void;
}

export function TaLogin({ onSuccess, onBackToPoll }: TaLoginProps) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Enter your TA passcode to continue.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ta/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error || 'Authentication failed.');
        return;
      }
      onSuccess(data.token);
    } catch {
      setError('Unable to reach server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          TA Control Panel
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Sign in with your teaching assistant passcode to view individual student responses, question breakdowns, and session controls.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="ta-passcode" className="block text-sm font-semibold text-slate-800">
              TA Passcode
            </label>
            <div className="relative mt-2">
              <input
                id="ta-passcode"
                type={showPasscode ? 'text' : 'password'}
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter TA passcode"
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((prev) => !prev)}
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <span>{loading ? 'Verifying...' : 'Unlock TA Dashboard'}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <button
            type="button"
            onClick={onBackToPoll}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            Return to student poll
          </button>
        </div>
      </motion.div>
    </div>
  );
}
