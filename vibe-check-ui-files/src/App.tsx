import { useCallback, useEffect, useState } from 'react';
import { TopBar, type AppRoute } from './components/TopBar.tsx';
import { StudentWelcome } from './components/StudentWelcome.tsx';
import { StudentQuiz } from './components/StudentQuiz.tsx';
import { StudentCompletion } from './components/StudentCompletion.tsx';
import { LiveResults } from './components/LiveResults.tsx';
import { TaLogin } from './components/TaLogin.tsx';
import { TaDashboard } from './components/TaDashboard.tsx';
import {
  clearStudentCredentials,
  clearTaToken,
  getOrCreateDeviceId,
  loadStudentCredentials,
  loadTaToken,
  saveStudentCredentials,
  saveTaToken,
} from './lib/storage.ts';
import {
  POLL_QUESTIONS,
  type AnswerChoice,
  type SessionPublicInfo,
  type StudentSelfState,
} from './shared/questions.ts';

function parseRouteFromPath(pathname: string): AppRoute {
  if (pathname.startsWith('/ta')) return 'ta';
  if (pathname.startsWith('/results')) return 'results';
  return 'student';
}

function getInitialJoinCode(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    return code ? code.trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRouteFromPath(window.location.pathname));
  const [session, setSession] = useState<SessionPublicInfo | null>(null);
  const [student, setStudent] = useState<StudentSelfState | null>(null);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [joining, setJoining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [taToken, setTaToken] = useState<string | null>(() => loadTaToken());
  const [urlJoinCode] = useState<string | null>(() => getInitialJoinCode());

  const navigate = useCallback((next: AppRoute) => {
    setRoute(next);
    const targetPath = next === 'ta' ? '/ta' : next === 'results' ? '/results' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const hydrateSessionAndStudent = useCallback(async () => {
    try {
      const sessionRes = await fetch('/api/session/active');
      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as { session: SessionPublicInfo };
        setSession(sessionData.session);

        const saved = loadStudentCredentials();
        if (saved && saved.sessionId === sessionData.session.id) {
          const meRes = await fetch(
            `/api/students/me?studentId=${encodeURIComponent(saved.studentId)}`,
            {
              headers: { 'x-student-token': saved.studentToken },
            }
          );
          if (meRes.ok) {
            const meData = (await meRes.json()) as { student: StudentSelfState };
            setStudent(meData.student);
            setStudentToken(saved.studentToken);
          } else if (meRes.status === 404 || meRes.status === 401) {
            clearStudentCredentials();
            setStudent(null);
            setStudentToken(null);
          }
        } else if (saved && saved.sessionId !== sessionData.session.id) {
          clearStudentCredentials();
          setStudent(null);
          setStudentToken(null);
        }
      }

      const existingTa = loadTaToken();
      if (existingTa) {
        const verifyRes = await fetch('/api/ta/verify', {
          headers: { Authorization: `Bearer ${existingTa}` },
        });
        if (!verifyRes.ok) {
          clearTaToken();
          setTaToken(null);
        }
      }
    } catch {
      // Keep graceful error handling if network momentarily fails
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    hydrateSessionAndStudent();
  }, [hydrateSessionAndStudent]);

  const handleJoin = async (name: string) => {
    setJoining(true);
    setStudentError(null);
    try {
      const deviceId = getOrCreateDeviceId();
      const saved = loadStudentCredentials();
      const res = await fetch('/api/students/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          deviceId,
          joinCode: urlJoinCode ?? undefined,
          existingToken: saved?.studentToken,
        }),
      });
      const data = (await res.json()) as {
        student?: StudentSelfState;
        studentToken?: string;
        error?: string;
      };
      if (!res.ok || !data.student || !data.studentToken) {
        setStudentError(data.error || 'Could not join the classroom poll.');
        return;
      }

      saveStudentCredentials({
        studentId: data.student.id,
        studentToken: data.studentToken,
        sessionId: data.student.sessionId,
      });
      setStudent(data.student);
      setStudentToken(data.studentToken);
      setJustCompleted(false);
    } catch {
      setStudentError('Connection issue while joining. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleSelectAnswer = async (questionId: string, choice: AnswerChoice) => {
    if (!student || !studentToken) return;
    setStudentError(null);

    // Optimistic local update
    setStudent((prev) => {
      if (!prev) return prev;
      const nextAnswers = { ...prev.answers, [questionId]: choice };
      return {
        ...prev,
        answers: nextAnswers,
        answeredCount: Object.keys(nextAnswers).length,
        status: prev.status === 'Completed' ? 'Completed' : 'In Progress',
      };
    });

    setSaving(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(student.id)}/answer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-student-token': studentToken,
        },
        body: JSON.stringify({ questionId, choice }),
      });
      const data = (await res.json()) as { student?: StudentSelfState; error?: string };
      if (!res.ok || !data.student) {
        setStudentError(data.error || 'Could not save your answer.');
        return;
      }
      setStudent(data.student);
    } catch {
      setStudentError('Connection interrupted while saving. Please try selecting again.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!student || !studentToken) return;
    setCompleting(true);
    setStudentError(null);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(student.id)}/complete`, {
        method: 'POST',
        headers: {
          'x-student-token': studentToken,
        },
      });
      const data = (await res.json()) as { student?: StudentSelfState; error?: string };
      if (!res.ok || !data.student) {
        setStudentError(data.error || 'Please answer all 10 questions before submitting.');
        return;
      }
      setStudent(data.student);
      setJustCompleted(true);
    } catch {
      setStudentError('Connection error while submitting. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const handleSessionResetFromStream = useCallback(() => {
    clearStudentCredentials();
    setStudent(null);
    setStudentToken(null);
    setJustCompleted(false);
    hydrateSessionAndStudent();
  }, [hydrateSessionAndStudent]);

  const canViewResults = student?.status === 'Completed';

  const firstUnansweredIndex = student
    ? Math.max(
        0,
        POLL_QUESTIONS.findIndex((q) => !student.answers[q.id])
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        currentRoute={route}
        onNavigate={navigate}
        canViewResults={canViewResults}
        isTaAuthenticated={Boolean(taToken)}
      />

      <main>
        {booting ? (
          <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-2xl items-center justify-center px-4">
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
              <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-4 w-72 animate-pulse rounded bg-slate-100" />
              <div className="mt-8 h-12 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        ) : route === 'ta' ? (
          taToken ? (
            <TaDashboard
              taToken={taToken}
              onUnauthorized={() => {
                clearTaToken();
                setTaToken(null);
              }}
              onLogout={() => {
                clearTaToken();
                setTaToken(null);
              }}
            />
          ) : (
            <TaLogin
              onSuccess={(token) => {
                saveTaToken(token);
                setTaToken(token);
              }}
              onBackToPoll={() => navigate('student')}
            />
          )
        ) : route === 'results' ? (
          canViewResults ? (
            <LiveResults onSessionReset={handleSessionResetFromStream} />
          ) : (
            <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-xl flex-col justify-center px-4 py-12 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900">
                  Finish the 10 questions first
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Live class results unlock right after you submit your own answers so nobody gets spoiled early.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('student')}
                  className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Go to Poll
                </button>
              </div>
            </div>
          )
        ) : !student ? (
          <StudentWelcome
            session={session}
            urlJoinCode={urlJoinCode}
            existingStudent={null}
            onJoin={handleJoin}
            onViewResults={() => navigate('results')}
            joining={joining}
            error={studentError}
          />
        ) : student.status === 'Completed' && justCompleted ? (
          <StudentCompletion
            student={student}
            onViewResults={() => {
              setJustCompleted(false);
              navigate('results');
            }}
          />
        ) : student.status === 'Completed' ? (
          <StudentWelcome
            session={session}
            urlJoinCode={urlJoinCode}
            existingStudent={student}
            onJoin={handleJoin}
            onViewResults={() => navigate('results')}
            joining={joining}
            error={studentError}
          />
        ) : (
          <StudentQuiz
            student={student}
            initialIndex={firstUnansweredIndex}
            onSelectAnswer={handleSelectAnswer}
            onComplete={handleComplete}
            saving={saving}
            completing={completing}
            error={studentError}
          />
        )}
      </main>
    </div>
  );
}
