import { Lock, BarChart3 } from 'lucide-react';

export type AppRoute = 'student' | 'results' | 'ta';

interface TopBarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  canViewResults: boolean;
  isTaAuthenticated: boolean;
}

export function TopBar({
  currentRoute,
  onNavigate,
  canViewResults,
  isTaAuthenticated,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('student')}
          className="text-left text-base font-bold tracking-tight text-slate-900 transition-colors hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap shrink-0 sm:text-lg"
        >
          The Class Vibe Check
        </button>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onNavigate('student')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm ${
              currentRoute === 'student'
                ? 'text-indigo-600 underline decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Join Poll
          </button>

          {canViewResults && (
            <button
              type="button"
              onClick={() => onNavigate('results')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm ${
                currentRoute === 'results'
                  ? 'text-indigo-600 underline decoration-2 underline-offset-8'
                  : ''
              }`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span>Live Results</span>
            </button>
          )}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('ta')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:text-sm ${
              currentRoute === 'ta'
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isTaAuthenticated ? 'TA Dashboard' : 'TA Access'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
