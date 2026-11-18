import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  LogOut,
  PlusCircle,
  QrCode,
  Radio,
  RotateCcw,
  Search,
  Users,
  BarChart2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'motion/react';
import {
  POLL_QUESTIONS,
  type StudentStatus,
  type TaDashboardPayload,
  type TaStudentRecord,
} from '../shared/questions.ts';

interface TaDashboardProps {
  taToken: string;
  onUnauthorized: () => void;
  onLogout: () => void;
}

type TaTab = 'students' | 'analytics' | 'session';
type StatusFilter = 'All' | StudentStatus;

export function TaDashboard({ taToken, onUnauthorized, onLogout }: TaDashboardProps) {
  const [data, setData] = useState<TaDashboardPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TaTab>('students');

  // Student table & individual response view
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Question-by-question analytics
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(POLL_QUESTIONS[0].id);

  // Session management & confirmation modals
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');
  const [confirmModal, setConfirmModal] = useState<'new_session' | 'reset_session' | null>(null);
  const [resetInput, setResetInput] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    let closed = false;
    const source = new EventSource(`/api/stream/ta?token=${encodeURIComponent(taToken)}`);

    source.onopen = () => {
      if (!closed) {
        setConnected(true);
        setError(null);
      }
    };

    const handlePayload = (event: Event) => {
      if (closed) return;
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as TaDashboardPayload;
        setData(parsed);
        setConnected(true);
        setError(null);
      } catch {
        // Ignore parse issues
      }
    };

    source.addEventListener('ta_overview', handlePayload);
    source.addEventListener('session_reset', handlePayload);

    source.onerror = async () => {
      if (closed) return;
      setConnected(false);
      try {
        const check = await fetch('/api/ta/verify', {
          headers: { Authorization: `Bearer ${taToken}` },
        });
        if (check.status === 401) {
          onUnauthorized();
          return;
        }
      } catch {
        // Network issue
      }
      setError('Live connection interrupted. Reconnecting...');
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [taToken, onUnauthorized]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.students.filter((s) => {
      const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
      const matchesName = !q || s.name.toLowerCase().includes(q);
      return matchesStatus && matchesName;
    });
  }, [data, searchQuery, statusFilter]);

  const selectedStudent: TaStudentRecord | null = useMemo(() => {
    if (!data || !selectedStudentId) return null;
    return data.students.find((s) => s.id === selectedStudentId) ?? null;
  }, [data, selectedStudentId]);

  const selectedQuestion = useMemo(
    () => POLL_QUESTIONS.find((q) => q.id === selectedQuestionId) ?? POLL_QUESTIONS[0],
    [selectedQuestionId]
  );

  const selectedBreakdown = useMemo(
    () => data?.questionBreakdowns.find((b) => b.questionId === selectedQuestion.id) ?? null,
    [data, selectedQuestion]
  );

  const joinUrl = useMemo(() => {
    if (!data || typeof window === 'undefined') return '';
    return `${window.location.origin}/?code=${encodeURIComponent(data.session.joinCode)}`;
  }, [data]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await fetch('/api/ta/export.csv', {
        headers: { Authorization: `Bearer ${taToken}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        setError('Could not export CSV. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class-vibe-check-${(data?.session.joinCode || 'export').toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download CSV export.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleConfirmSessionAction = async () => {
    if (!confirmModal) return;
    if (confirmModal === 'reset_session' && resetInput.trim().toUpperCase() !== 'RESET') {
      return;
    }

    setActionBusy(true);
    setError(null);
    try {
      const endpoint =
        confirmModal === 'new_session' ? '/api/ta/session/new' : '/api/ta/session/reset';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${taToken}`,
        },
        body:
          confirmModal === 'new_session'
            ? JSON.stringify({ label: newSessionLabel.trim() || undefined })
            : undefined,
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        setError('Failed to update classroom session.');
        return;
      }
      setSelectedStudentId(null);
      setNewSessionLabel('');
      setResetInput('');
      setConfirmModal(null);
    } catch {
      setError('Network error while updating session.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopy = async (text: string, type: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Clipboard blocked
    }
  };

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="mt-6 h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Top Dashboard Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center">
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
              {connected ? 'LIVE SYNC' : 'RECONNECTING'}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-slate-600">{data.session.label}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-slate-700">Code {data.session.joinCode}</span>
          </div>

          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            TA Control Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <span>{exportingCsv ? 'Exporting...' : 'EXPORT CSV'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap shrink-0"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          {error}
        </div>
      )}

      {/* 4 Overview Stat Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Total joined</span>
            <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {data.stats.totalJoined}
          </div>
          <div className="mt-1 text-xs text-slate-500">Active classroom participants</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-teal-700">
            {data.stats.completedCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">Submitted all 10 questions</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>In progress</span>
            <Clock className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-indigo-700">
            {data.stats.stillAnsweringCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {data.stats.inProgressCount} answering · {data.stats.joinedOnlyCount} just joined
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Completion rate</span>
            <BarChart2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {data.stats.completionRate}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-300"
              style={{ width: `${data.stats.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-8 flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 sm:inline-flex">
        {(
          [
            { id: 'students', label: `Students (${data.stats.totalJoined})`, icon: Users },
            { id: 'analytics', label: 'Question Analytics', icon: BarChart2 },
            { id: 'session', label: 'Session & QR Code', icon: QrCode },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'students') setSelectedStudentId(null);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STUDENTS TABLE OR INDIVIDUAL RESPONSE */}
      {activeTab === 'students' && (
        <div className="mt-6">
          {selectedStudent ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
            >
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to student list</span>
              </button>

              <div className="mt-5 flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Student: {selectedStudent.name}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      Joined {new Date(selectedStudent.joinedAt).toLocaleString()}
                    </span>
                    {selectedStudent.completedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Completed {new Date(selectedStudent.completedAt).toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-500">Status</div>
                    <div
                      className={`text-sm font-bold ${
                        selectedStudent.status === 'Completed'
                          ? 'text-teal-700'
                          : selectedStudent.status === 'In Progress'
                          ? 'text-indigo-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {selectedStudent.status}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-500">Progress</div>
                    <div className="font-mono text-sm font-bold tabular-nums text-slate-900">
                      {selectedStudent.answeredCount}/10
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 divide-y divide-slate-100">
                {POLL_QUESTIONS.map((q) => {
                  const choice = selectedStudent.answers[q.id];
                  const answerText =
                    choice === 'A' ? q.optionA : choice === 'B' ? q.optionB : null;
                  return (
                    <div
                      key={q.id}
                      className="flex flex-col justify-between gap-2 py-3.5 sm:flex-row sm:items-center"
                    >
                      <div className="text-sm font-medium text-slate-700">
                        <span className="mr-2 font-mono text-xs font-semibold text-slate-400">
                          Q{q.number}.
                        </span>
                        {q.prompt}
                      </div>
                      <div className="sm:text-right">
                        {answerText ? (
                          <span className="text-sm font-semibold text-slate-900">
                            {answerText}
                          </span>
                        ) : (
                          <span className="text-xs italic text-slate-400">
                            Not answered yet
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student by name..."
                    aria-label="Search student by name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
                  {(['All', 'Completed', 'In Progress', 'Joined'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        statusFilter === status
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-base font-semibold text-slate-900">
                    {data.students.length === 0
                      ? 'No students have joined yet'
                      : 'No matching students found'}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-500">
                    {data.students.length === 0
                      ? 'Share the classroom QR code or join link so students can enter their names.'
                      : 'Try clearing your search or status filter.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3.5">Student Name</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Progress</th>
                        <th className="px-5 py-3.5 text-right">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student) => (
                        <tr
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          className="cursor-pointer transition-colors hover:bg-indigo-50/40"
                        >
                          <td className="px-5 py-3.5 font-semibold text-slate-900">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(student.id);
                              }}
                              className="text-left hover:text-indigo-600 focus-visible:outline-none focus-visible:underline"
                            >
                              {student.name}
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`text-xs font-semibold ${
                                student.status === 'Completed'
                                  ? 'text-teal-700'
                                  : student.status === 'In Progress'
                                  ? 'text-indigo-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              {student.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-slate-700">
                            {student.answeredCount}/10
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-slate-500">
                            {new Date(student.joinedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: QUESTION-BY-QUESTION ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {POLL_QUESTIONS.map((q) => {
              const b = data.questionBreakdowns.find((item) => item.questionId === q.id);
              const active = q.id === selectedQuestion.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono">Q{q.number}</span>
                  <span
                    className={`font-mono tabular-nums ${
                      active ? 'text-indigo-100' : 'text-slate-400'
                    }`}
                  >
                    {b?.totalAnswered ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Question {selectedQuestion.number} of 10
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {selectedQuestion.prompt}
                </h2>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs font-medium text-slate-500">
                  Total responses for Q{selectedQuestion.number}
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {selectedBreakdown?.totalAnswered ?? 0}
                </div>
              </div>
            </div>

            {/* Split Visual Comparison Chart */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="text-indigo-700">
                  {selectedQuestion.optionA} ({selectedBreakdown?.percentA ?? 0}%)
                </span>
                <span className="text-teal-700">
                  {selectedQuestion.optionB} ({selectedBreakdown?.percentB ?? 0}%)
                </span>
              </div>
              <div className="mt-2 flex h-5 w-full overflow-hidden rounded-full bg-slate-100">
                {(selectedBreakdown?.totalAnswered ?? 0) > 0 ? (
                  <>
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${selectedBreakdown?.percentA ?? 0}%` }}
                    />
                    <div
                      className="h-full bg-teal-600 transition-all duration-300"
                      style={{ width: `${selectedBreakdown?.percentB ?? 0}%` }}
                    />
                  </>
                ) : null}
              </div>
            </div>

            {/* Option 1 & Option 2 Student Lists */}
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      Option A
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">
                      {selectedQuestion.optionA}
                    </h3>
                  </div>
                  <div className="text-right font-mono text-sm font-bold tabular-nums text-indigo-700 whitespace-nowrap shrink-0">
                    {selectedBreakdown?.countA ?? 0} votes – {selectedBreakdown?.percentA ?? 0}%
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200/80 pt-4">
                  {selectedBreakdown && selectedBreakdown.studentsA.length > 0 ? (
                    <ul className="space-y-1.5 text-sm text-slate-800">
                      {selectedBreakdown.studentsA.map((name, idx) => (
                        <li key={`${name}-${idx}`} className="font-medium">
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">No students selected this option yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-600">
                      Option B
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">
                      {selectedQuestion.optionB}
                    </h3>
                  </div>
                  <div className="text-right font-mono text-sm font-bold tabular-nums text-teal-700 whitespace-nowrap shrink-0">
                    {selectedBreakdown?.countB ?? 0} votes – {selectedBreakdown?.percentB ?? 0}%
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200/80 pt-4">
                  {selectedBreakdown && selectedBreakdown.studentsB.length > 0 ? (
                    <ul className="space-y-1.5 text-sm text-slate-800">
                      {selectedBreakdown.studentsB.map((name, idx) => (
                        <li key={`${name}-${idx}`} className="font-medium">
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">No students selected this option yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SESSION MANAGEMENT & QR CODE */}
      {activeTab === 'session' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">Classroom Join QR & Link</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Project this QR code or share the link so students can join the active poll from their phones or laptops.
            </p>

            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <QRCodeSVG value={joinUrl} size={172} level="M" includeMargin={false} />
              </div>

              <div className="flex-1 space-y-4 w-full">
                <div>
                  <div className="text-xs font-medium text-slate-500">Active Session</div>
                  <div className="mt-0.5 text-base font-bold text-slate-900">
                    {data.session.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    Started {new Date(data.session.createdAt).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">Session Join Code</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-lg font-bold tracking-wider text-slate-900">
                      {data.session.joinCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.session.joinCode, 'code')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {copiedCode ? (
                        <Check className="h-3.5 w-3.5 text-teal-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">Direct Student URL</div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={joinUrl}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(joinUrl, 'link')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">Session Controls</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Start a fresh classroom session with a new join code, or reset the current session&apos;s responses.
            </p>

            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="text-base font-bold text-slate-900">Start New Classroom Session</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Archives the current session and generates a brand-new join code for a new class.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    maxLength={60}
                    value={newSessionLabel}
                    onChange={(e) => setNewSessionLabel(e.target.value)}
                    placeholder="Optional label (e.g. CS 101 · Section B)"
                    className="w-full flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmModal('new_session')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    <span>New Session</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
                <h3 className="text-base font-bold text-rose-950">Reset Current Session</h3>
                <p className="mt-1 text-sm text-rose-800">
                  Permanently clears all {data.stats.totalJoined} student responses in this session while keeping the current join code ({data.session.joinCode}).
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setResetInput('');
                      setConfirmModal('reset_session');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>Reset Session Responses</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {confirmModal === 'new_session'
                  ? 'Start a new classroom session?'
                  : 'Clear all current student responses?'}
              </h3>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {confirmModal === 'new_session'
                ? 'This will close the current session, generate a fresh join code, and reset live results to zero for incoming students.'
                : `This will permanently delete all ${data.stats.totalJoined} student entries and answers in session ${data.session.joinCode}. Export a CSV first if you want to keep a copy.`}
            </p>

            {confirmModal === 'reset_session' && (
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700">
                  Type <span className="font-mono text-rose-700">RESET</span> to confirm
                </label>
                <input
                  type="text"
                  autoFocus
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  placeholder="RESET"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  setConfirmModal(null);
                  setResetInput('');
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  actionBusy ||
                  (confirmModal === 'reset_session' && resetInput.trim().toUpperCase() !== 'RESET')
                }
                onClick={handleConfirmSessionAction}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionBusy
                  ? 'Processing...'
                  : confirmModal === 'new_session'
                  ? 'Start New Session'
                  : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
