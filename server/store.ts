import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  POLL_QUESTIONS,
  type AnswerChoice,
  type AnswersMap,
  type PublicLiveResults,
  type QuestionAggregate,
  type SessionPublicInfo,
  type StudentSelfState,
  type StudentStatus,
  type TaDashboardPayload,
  type TaQuestionBreakdown,
  type TaStudentRecord,
} from '../src/shared/questions.ts';
import {
  getSupabaseAdmin,
  isProductionDeployment,
  isSupabaseConfigured,
} from './supabase.ts';

interface StoredStudent {
  id: string;
  sessionId: string;
  deviceId: string;
  tokenHash: string;
  name: string;
  status: StudentStatus;
  answers: AnswersMap;
  joinedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface StoredSession {
  id: string;
  label: string;
  joinCode: string;
  createdAt: string;
  students: StoredStudent[];
}

interface DatabaseSchema {
  activeSession: StoredSession;
  archivedSessions: StoredSession[];
}

interface CampSessionRow {
  id: string;
  label: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
  archived_at?: string | null;
}

interface CampStudentRow {
  id: string;
  session_id: string;
  device_id: string;
  token_hash: string;
  name: string;
  status: StudentStatus;
  joined_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface CampAnswerRow {
  session_id: string;
  student_id: string;
  question_id: string;
  choice: AnswerChoice;
}

export type JoinStudentResult =
  | { ok: true; student: StudentSelfState; studentToken: string; resumed: boolean }
  | { ok: false; status: number; code: string; error: string };

export type SaveAnswerResult =
  | { ok: true; student: StudentSelfState }
  | { ok: false; status: number; error: string };

export type CompleteStudentResult =
  | { ok: true; student: StudentSelfState; newlyCompleted: boolean }
  | { ok: false; status: number; error: string };

export interface VibeStore {
  getActiveSessionPublic(): Promise<SessionPublicInfo>;
  joinStudent(params: {
    name: string;
    deviceId: string;
    joinCode?: string;
    existingToken?: string;
  }): Promise<JoinStudentResult>;
  getStudentSelf(studentId: string, studentToken: string): Promise<StudentSelfState | null>;
  saveAnswer(params: {
    studentId: string;
    studentToken: string;
    questionId: string;
    choice: AnswerChoice;
  }): Promise<SaveAnswerResult>;
  completeStudent(params: {
    studentId: string;
    studentToken: string;
  }): Promise<CompleteStudentResult>;
  getPublicLiveResults(): Promise<PublicLiveResults>;
  getTaDashboardPayload(): Promise<TaDashboardPayload>;
  getTaStudentById(studentId: string): Promise<TaStudentRecord | null>;
  buildCsvExport(): Promise<string>;
  startNewSession(label?: string): Promise<SessionPublicInfo>;
  resetCurrentSession(): Promise<SessionPublicInfo>;
}

const VALID_QUESTION_IDS = new Set(POLL_QUESTIONS.map((q) => q.id));

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `VIBE-${suffix}`;
}

function defaultSessionLabel(label?: string): string {
  if (label && label.trim()) {
    return label.trim().slice(0, 60);
  }
  return `Class Session (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function tokensEqual(rawToken: string, expectedHash: string): boolean {
  const actualBuf = Buffer.from(hashToken(rawToken), 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function buildPublicResultsPayload(
  session: SessionPublicInfo,
  students: Array<{ id: string; status: StudentStatus }>,
  answers: Array<{ studentId: string; questionId: string; choice: AnswerChoice }>
): PublicLiveResults {
  const totalJoined = students.length;
  const completedIds = new Set(students.filter((s) => s.status === 'Completed').map((s) => s.id));
  const completedCount = completedIds.size;
  const stillAnsweringCount = totalJoined - completedCount;

  const countsByQuestion = new Map<string, { countA: number; countB: number }>();
  for (const q of POLL_QUESTIONS) {
    countsByQuestion.set(q.id, { countA: 0, countB: 0 });
  }

  for (const ans of answers) {
    if (!completedIds.has(ans.studentId)) continue;
    const bucket = countsByQuestion.get(ans.questionId);
    if (!bucket) continue;
    if (ans.choice === 'A') bucket.countA++;
    else if (ans.choice === 'B') bucket.countB++;
  }

  const questions: QuestionAggregate[] = POLL_QUESTIONS.map((q) => {
    const bucket = countsByQuestion.get(q.id) ?? { countA: 0, countB: 0 };
    const totalVotes = bucket.countA + bucket.countB;
    const percentA = totalVotes > 0 ? Math.round((bucket.countA / totalVotes) * 100) : 0;
    const percentB = totalVotes > 0 ? 100 - percentA : 0;
    return {
      questionId: q.id,
      totalVotes,
      countA: bucket.countA,
      countB: bucket.countB,
      percentA,
      percentB,
    };
  });

  return {
    session,
    totalJoined,
    completedCount,
    stillAnsweringCount,
    questions,
    updatedAt: new Date().toISOString(),
  };
}

function buildTaPayload(
  session: SessionPublicInfo,
  studentRecords: TaStudentRecord[]
): TaDashboardPayload {
  const totalJoined = studentRecords.length;
  const completedCount = studentRecords.filter((s) => s.status === 'Completed').length;
  const inProgressCount = studentRecords.filter((s) => s.status === 'In Progress').length;
  const joinedOnlyCount = studentRecords.filter((s) => s.status === 'Joined').length;
  const stillAnsweringCount = totalJoined - completedCount;
  const completionRate = totalJoined > 0 ? Math.round((completedCount / totalJoined) * 100) : 0;

  const questionBreakdowns: TaQuestionBreakdown[] = POLL_QUESTIONS.map((q) => {
    const studentsA: string[] = [];
    const studentsB: string[] = [];

    for (const s of studentRecords) {
      const choice = s.answers[q.id];
      if (choice === 'A') studentsA.push(s.name);
      else if (choice === 'B') studentsB.push(s.name);
    }

    const countA = studentsA.length;
    const countB = studentsB.length;
    const totalAnswered = countA + countB;
    const percentA = totalAnswered > 0 ? Math.round((countA / totalAnswered) * 100) : 0;
    const percentB = totalAnswered > 0 ? 100 - percentA : 0;

    return {
      questionId: q.id,
      totalAnswered,
      countA,
      countB,
      percentA,
      percentB,
      studentsA,
      studentsB,
    };
  });

  return {
    session,
    stats: {
      totalJoined,
      completedCount,
      inProgressCount,
      joinedOnlyCount,
      stillAnsweringCount,
      completionRate,
    },
    students: studentRecords,
    questionBreakdowns,
    updatedAt: new Date().toISOString(),
  };
}

function buildCsvString(students: TaStudentRecord[]): string {
  const headers = [
    'Student Name',
    'Status',
    'Progress',
    'Joined At',
    'Completed At',
    ...POLL_QUESTIONS.map((q) => `Q${q.number}: ${q.prompt}`),
  ];

  const escapeCsv = (value: string): string => {
    const safe = value.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const rows = students.map((s) => {
    const answerTexts = POLL_QUESTIONS.map((q) => {
      const choice = s.answers[q.id];
      if (choice === 'A') return q.optionA;
      if (choice === 'B') return q.optionB;
      return '';
    });

    return [
      s.name,
      s.status,
      `${s.answeredCount}/10`,
      s.joinedAt,
      s.completedAt ?? '',
      ...answerTexts,
    ]
      .map(escapeCsv)
      .join(',');
  });

  return `\uFEFF${[headers.map(escapeCsv).join(','), ...rows].join('\r\n')}`;
}

class SupabaseVibeStore implements VibeStore {
  private toSessionPublic(row: CampSessionRow): SessionPublicInfo {
    return {
      id: row.id,
      label: row.label,
      joinCode: row.join_code,
      createdAt: row.created_at,
    };
  }

  private async getStudentAnswersMap(studentId: string, sessionId: string): Promise<AnswersMap> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('camp_answers')
      .select('question_id, choice')
      .eq('student_id', studentId)
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Failed to load student answers: ${error.message}`);
    }

    const answers: AnswersMap = {};
    for (const row of (data ?? []) as Array<{ question_id: string; choice: AnswerChoice }>) {
      if (VALID_QUESTION_IDS.has(row.question_id) && (row.choice === 'A' || row.choice === 'B')) {
        answers[row.question_id] = row.choice;
      }
    }
    return answers;
  }

  private toStudentSelf(row: CampStudentRow, answers: AnswersMap): StudentSelfState {
    const answeredCount = Object.keys(answers).filter((k) => VALID_QUESTION_IDS.has(k)).length;
    return {
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      status: row.status,
      answers,
      answeredCount,
      joinedAt: row.joined_at,
      completedAt: row.completed_at,
    };
  }

  private async getOrCreateActiveSessionRow(): Promise<CampSessionRow> {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: fetchError } = await supabase
      .from('camp_sessions')
      .select('id, label, join_code, is_active, created_at, archived_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch active session: ${fetchError.message}`);
    }
    if (existing) {
      return existing as CampSessionRow;
    }

    const now = new Date().toISOString();
    const newSession = {
      id: crypto.randomUUID(),
      label: 'Live Classroom Session',
      join_code: generateJoinCode(),
      is_active: true,
      created_at: now,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('camp_sessions')
      .insert(newSession)
      .select('id, label, join_code, is_active, created_at, archived_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: winner, error: retryError } = await supabase
          .from('camp_sessions')
          .select('id, label, join_code, is_active, created_at, archived_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (retryError || !winner) {
          throw new Error(`Failed to resolve active session: ${retryError?.message || insertError.message}`);
        }
        return winner as CampSessionRow;
      }
      throw new Error(`Failed to create initial session: ${insertError.message}`);
    }

    return inserted as CampSessionRow;
  }

  public async getActiveSessionPublic(): Promise<SessionPublicInfo> {
    const row = await this.getOrCreateActiveSessionRow();
    return this.toSessionPublic(row);
  }

  public async joinStudent(params: {
    name: string;
    deviceId: string;
    joinCode?: string;
    existingToken?: string;
  }): Promise<JoinStudentResult> {
    const trimmedName = params.name.trim().replace(/\s+/g, ' ');
    if (trimmedName.length < 1 || trimmedName.length > 40) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_NAME',
        error: 'Please enter a display name between 1 and 40 characters.',
      };
    }

    const cleanDeviceId = params.deviceId.trim();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(cleanDeviceId)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_DEVICE',
        error: 'Invalid browser session identifier. Please reload and try again.',
      };
    }

    const session = await this.getOrCreateActiveSessionRow();
    if (params.joinCode && params.joinCode.trim().length > 0) {
      if (params.joinCode.trim().toUpperCase() !== session.join_code.toUpperCase()) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_JOIN_CODE',
          error: 'That join code does not match the active classroom session.',
        };
      }
    }

    const supabase = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabase
      .from('camp_students')
      .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
      .eq('session_id', session.id)
      .eq('device_id', cleanDeviceId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to check existing participation: ${lookupError.message}`);
    }

    if (existing) {
      const existingRow = existing as CampStudentRow;
      if (params.existingToken && tokensEqual(params.existingToken, existingRow.token_hash)) {
        const answers = await this.getStudentAnswersMap(existingRow.id, session.id);
        return {
          ok: true,
          student: this.toStudentSelf(existingRow, answers),
          studentToken: params.existingToken,
          resumed: true,
        };
      }
      return {
        ok: false,
        status: 409,
        code: 'DUPLICATE_PARTICIPATION',
        error: `This device has already joined the active session as "${existingRow.name}". Duplicate submissions are disabled.`,
      };
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    const studentPayload = {
      id: crypto.randomUUID(),
      session_id: session.id,
      device_id: cleanDeviceId,
      token_hash: hashToken(rawToken),
      name: trimmedName,
      status: 'Joined' as StudentStatus,
      joined_at: now,
      updated_at: now,
      completed_at: null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('camp_students')
      .insert(studentPayload)
      .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: raced } = await supabase
          .from('camp_students')
          .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
          .eq('session_id', session.id)
          .eq('device_id', cleanDeviceId)
          .maybeSingle();

        if (raced) {
          const racedRow = raced as CampStudentRow;
          if (params.existingToken && tokensEqual(params.existingToken, racedRow.token_hash)) {
            const answers = await this.getStudentAnswersMap(racedRow.id, session.id);
            return {
              ok: true,
              student: this.toStudentSelf(racedRow, answers),
              studentToken: params.existingToken,
              resumed: true,
            };
          }
          return {
            ok: false,
            status: 409,
            code: 'DUPLICATE_PARTICIPATION',
            error: `This device has already joined the active session as "${racedRow.name}". Duplicate submissions are disabled.`,
          };
        }
      }
      throw new Error(`Failed to register student: ${insertError.message}`);
    }

    return {
      ok: true,
      student: this.toStudentSelf(inserted as CampStudentRow, {}),
      studentToken: rawToken,
      resumed: false,
    };
  }

  public async getStudentSelf(studentId: string, studentToken: string): Promise<StudentSelfState | null> {
    const session = await this.getOrCreateActiveSessionRow();
    const supabase = getSupabaseAdmin();
    const { data: student, error } = await supabase
      .from('camp_students')
      .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
      .eq('id', studentId)
      .eq('session_id', session.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch student session: ${error.message}`);
    }
    if (!student) return null;

    const studentRow = student as CampStudentRow;
    if (!tokensEqual(studentToken, studentRow.token_hash)) return null;

    const answers = await this.getStudentAnswersMap(studentRow.id, session.id);
    return this.toStudentSelf(studentRow, answers);
  }

  public async saveAnswer(params: {
    studentId: string;
    studentToken: string;
    questionId: string;
    choice: AnswerChoice;
  }): Promise<SaveAnswerResult> {
    if (!VALID_QUESTION_IDS.has(params.questionId)) {
      return { ok: false, status: 400, error: 'Unknown question identifier.' };
    }
    if (params.choice !== 'A' && params.choice !== 'B') {
      return { ok: false, status: 400, error: 'Invalid answer choice.' };
    }

    const session = await this.getOrCreateActiveSessionRow();
    const supabase = getSupabaseAdmin();
    const { data: student, error: studentError } = await supabase
      .from('camp_students')
      .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
      .eq('id', params.studentId)
      .eq('session_id', session.id)
      .maybeSingle();

    if (studentError) {
      throw new Error(`Failed to verify student: ${studentError.message}`);
    }
    const studentRow = student as CampStudentRow | null;
    if (!studentRow || !tokensEqual(params.studentToken, studentRow.token_hash)) {
      return { ok: false, status: 401, error: 'Session verification failed. Please rejoin the active poll.' };
    }

    if (studentRow.status === 'Completed') {
      return { ok: false, status: 400, error: 'Responses are locked after submission.' };
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from('camp_answers').upsert(
      {
        session_id: studentRow.session_id,
        student_id: studentRow.id,
        question_id: params.questionId,
        choice: params.choice,
        updated_at: now,
      },
      { onConflict: 'student_id,question_id' }
    );

    if (upsertError) {
      throw new Error(`Failed to save answer: ${upsertError.message}`);
    }

    const { data: updatedStudent, error: updateError } = await supabase
      .from('camp_students')
      .update({ status: 'In Progress', updated_at: now })
      .eq('id', studentRow.id)
      .neq('status', 'Completed')
      .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update student progress: ${updateError.message}`);
    }
    if (!updatedStudent) {
      return { ok: false, status: 400, error: 'Responses are locked after submission.' };
    }

    const answers = await this.getStudentAnswersMap(studentRow.id, studentRow.session_id);
    return {
      ok: true,
      student: this.toStudentSelf(updatedStudent as CampStudentRow, answers),
    };
  }

  public async completeStudent(params: {
    studentId: string;
    studentToken: string;
  }): Promise<CompleteStudentResult> {
    const session = await this.getOrCreateActiveSessionRow();
    const supabase = getSupabaseAdmin();
    const { data: student, error: studentError } = await supabase
      .from('camp_students')
      .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
      .eq('id', params.studentId)
      .eq('session_id', session.id)
      .maybeSingle();

    if (studentError) {
      throw new Error(`Failed to verify student completion: ${studentError.message}`);
    }
    const studentRow = student as CampStudentRow | null;
    if (!studentRow || !tokensEqual(params.studentToken, studentRow.token_hash)) {
      return { ok: false, status: 401, error: 'Session verification failed. Please rejoin the active poll.' };
    }

    const answers = await this.getStudentAnswersMap(studentRow.id, studentRow.session_id);

    if (studentRow.status === 'Completed') {
      return {
        ok: true,
        student: this.toStudentSelf(studentRow, answers),
        newlyCompleted: false,
      };
    }

    const missing = POLL_QUESTIONS.filter((q) => answers[q.id] !== 'A' && answers[q.id] !== 'B');
    if (missing.length > 0) {
      return {
        ok: false,
        status: 400,
        error: `Please answer all 10 questions before submitting (missing ${missing.map((m) => `Q${m.number}`).join(', ')}).`,
      };
    }

    const now = new Date().toISOString();
    const { data: completedRow, error: completeError } = await supabase
      .from('camp_students')
      .update({
        status: 'Completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', studentRow.id)
      .select('id, session_id, device_id, token_hash, name, status, joined_at, updated_at, completed_at')
      .single();

    if (completeError || !completedRow) {
      throw new Error(`Failed to finalize submission: ${completeError?.message || 'Unknown error'}`);
    }

    return {
      ok: true,
      student: this.toStudentSelf(completedRow as CampStudentRow, answers),
      newlyCompleted: true,
    };
  }

  public async getPublicLiveResults(): Promise<PublicLiveResults> {
    const sessionRow = await this.getOrCreateActiveSessionRow();
    const supabase = getSupabaseAdmin();

    const [{ data: studentsData, error: studentsError }, { data: answersData, error: answersError }] =
      await Promise.all([
        supabase
          .from('camp_students')
          .select('id, status')
          .eq('session_id', sessionRow.id),
        supabase
          .from('camp_answers')
          .select('student_id, question_id, choice')
          .eq('session_id', sessionRow.id),
      ]);

    if (studentsError) {
      throw new Error(`Failed to fetch public student counts: ${studentsError.message}`);
    }
    if (answersError) {
      throw new Error(`Failed to fetch public vote counts: ${answersError.message}`);
    }

    const students = (studentsData ?? []) as Array<{ id: string; status: StudentStatus }>;
    const answers = ((answersData ?? []) as Array<{ student_id: string; question_id: string; choice: AnswerChoice }>).map(
      (a) => ({
        studentId: a.student_id,
        questionId: a.question_id,
        choice: a.choice,
      })
    );

    return buildPublicResultsPayload(this.toSessionPublic(sessionRow), students, answers);
  }

  private async loadTaRecordsForSession(sessionId: string): Promise<TaStudentRecord[]> {
    const supabase = getSupabaseAdmin();
    const [{ data: studentsData, error: studentsError }, { data: answersData, error: answersError }] =
      await Promise.all([
        supabase
          .from('camp_students')
          .select('id, name, status, joined_at, updated_at, completed_at')
          .eq('session_id', sessionId)
          .order('joined_at', { ascending: false }),
        supabase
          .from('camp_answers')
          .select('student_id, question_id, choice')
          .eq('session_id', sessionId),
      ]);

    if (studentsError) {
      throw new Error(`Failed to load TA students: ${studentsError.message}`);
    }
    if (answersError) {
      throw new Error(`Failed to load TA answers: ${answersError.message}`);
    }

    const answersByStudent = new Map<string, AnswersMap>();
    for (const row of (answersData ?? []) as Array<{ student_id: string; question_id: string; choice: AnswerChoice }>) {
      if (!VALID_QUESTION_IDS.has(row.question_id) || (row.choice !== 'A' && row.choice !== 'B')) {
        continue;
      }
      let map = answersByStudent.get(row.student_id);
      if (!map) {
        map = {};
        answersByStudent.set(row.student_id, map);
      }
      map[row.question_id] = row.choice;
    }

    return ((studentsData ?? []) as Array<Omit<CampStudentRow, 'session_id' | 'device_id' | 'token_hash'>>).map(
      (s) => {
        const answers = answersByStudent.get(s.id) ?? {};
        return {
          id: s.id,
          name: s.name,
          status: s.status,
          answers,
          answeredCount: Object.keys(answers).filter((k) => VALID_QUESTION_IDS.has(k)).length,
          joinedAt: s.joined_at,
          updatedAt: s.updated_at,
          completedAt: s.completed_at,
        };
      }
    );
  }

  public async getTaDashboardPayload(): Promise<TaDashboardPayload> {
    const sessionRow = await this.getOrCreateActiveSessionRow();
    const records = await this.loadTaRecordsForSession(sessionRow.id);
    return buildTaPayload(this.toSessionPublic(sessionRow), records);
  }

  public async getTaStudentById(studentId: string): Promise<TaStudentRecord | null> {
    const sessionRow = await this.getOrCreateActiveSessionRow();
    const supabase = getSupabaseAdmin();

    const { data: student, error } = await supabase
      .from('camp_students')
      .select('id, session_id, name, status, joined_at, updated_at, completed_at')
      .eq('id', studentId)
      .eq('session_id', sessionRow.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load student details: ${error.message}`);
    }
    if (!student) return null;

    const answers = await this.getStudentAnswersMap(student.id, sessionRow.id);
    return {
      id: student.id,
      name: student.name,
      status: student.status as StudentStatus,
      answers,
      answeredCount: Object.keys(answers).filter((k) => VALID_QUESTION_IDS.has(k)).length,
      joinedAt: student.joined_at,
      updatedAt: student.updated_at,
      completedAt: student.completed_at,
    };
  }

  public async buildCsvExport(): Promise<string> {
    const sessionRow = await this.getOrCreateActiveSessionRow();
    const records = await this.loadTaRecordsForSession(sessionRow.id);
    return buildCsvString(records);
  }

  public async startNewSession(label?: string): Promise<SessionPublicInfo> {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { error: archiveError } = await supabase
      .from('camp_sessions')
      .update({ is_active: false, archived_at: now })
      .eq('is_active', true);

    if (archiveError) {
      throw new Error(`Failed to archive active session: ${archiveError.message}`);
    }

    const newSession = {
      id: crypto.randomUUID(),
      label: defaultSessionLabel(label),
      join_code: generateJoinCode(),
      is_active: true,
      created_at: now,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('camp_sessions')
      .insert(newSession)
      .select('id, label, join_code, is_active, created_at, archived_at')
      .single();

    if (insertError || !inserted) {
      throw new Error(`Failed to create new session: ${insertError?.message || 'Unknown error'}`);
    }

    return this.toSessionPublic(inserted as CampSessionRow);
  }

  public async resetCurrentSession(): Promise<SessionPublicInfo> {
    const sessionRow = await this.getOrCreateActiveSessionRow();
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { error: delAnswersError } = await supabase
      .from('camp_answers')
      .delete()
      .eq('session_id', sessionRow.id);

    if (delAnswersError) {
      throw new Error(`Failed to clear session answers: ${delAnswersError.message}`);
    }

    const { error: delStudentsError } = await supabase
      .from('camp_students')
      .delete()
      .eq('session_id', sessionRow.id);

    if (delStudentsError) {
      throw new Error(`Failed to clear session students: ${delStudentsError.message}`);
    }

    const { data: updated, error: updateError } = await supabase
      .from('camp_sessions')
      .update({ created_at: now })
      .eq('id', sessionRow.id)
      .select('id, label, join_code, is_active, created_at, archived_at')
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to reset session timestamp: ${updateError?.message || 'Unknown error'}`);
    }

    return this.toSessionPublic(updated as CampSessionRow);
  }
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'vibe-check-db.json');

function createFreshLocalSession(label?: string): StoredSession {
  return {
    id: `sess_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    label: defaultSessionLabel(label),
    joinCode: generateJoinCode(),
    createdAt: new Date().toISOString(),
    students: [],
  };
}

class LocalJsonVibeStore implements VibeStore {
  private db: DatabaseSchema;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.db = this.loadFromDisk();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadFromDisk(): DatabaseSchema {
    this.ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && parsed.activeSession && Array.isArray(parsed.activeSession.students)) {
          return {
            activeSession: parsed.activeSession,
            archivedSessions: Array.isArray(parsed.archivedSessions) ? parsed.archivedSessions : [],
          };
        }
      } catch (err) {
        console.error('Failed to read database file, initializing fresh store:', err);
      }
    }
    const initial: DatabaseSchema = {
      activeSession: createFreshLocalSession('Live Classroom Session'),
      archivedSessions: [],
    };
    this.writeSync(initial);
    return initial;
  }

  private writeSync(data: DatabaseSchema): void {
    this.ensureDataDir();
    const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_FILE);
  }

  private persist(): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(this.db)) as DatabaseSchema;
    this.writeQueue = this.writeQueue.then(() => {
      this.writeSync(snapshot);
    });
    return this.writeQueue;
  }

  public async getActiveSessionPublic(): Promise<SessionPublicInfo> {
    const { id, label, joinCode, createdAt } = this.db.activeSession;
    return { id, label, joinCode, createdAt };
  }

  private toStudentSelf(student: StoredStudent): StudentSelfState {
    const answeredCount = Object.keys(student.answers).filter((k) => VALID_QUESTION_IDS.has(k)).length;
    return {
      id: student.id,
      sessionId: student.sessionId,
      name: student.name,
      status: student.status,
      answers: { ...student.answers },
      answeredCount,
      joinedAt: student.joinedAt,
      completedAt: student.completedAt,
    };
  }

  public async joinStudent(params: {
    name: string;
    deviceId: string;
    joinCode?: string;
    existingToken?: string;
  }): Promise<JoinStudentResult> {
    const trimmedName = params.name.trim().replace(/\s+/g, ' ');
    if (trimmedName.length < 1 || trimmedName.length > 40) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_NAME',
        error: 'Please enter a display name between 1 and 40 characters.',
      };
    }

    const cleanDeviceId = params.deviceId.trim();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(cleanDeviceId)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_DEVICE',
        error: 'Invalid browser session identifier. Please reload and try again.',
      };
    }

    const session = this.db.activeSession;
    if (params.joinCode && params.joinCode.trim().length > 0) {
      if (params.joinCode.trim().toUpperCase() !== session.joinCode.toUpperCase()) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_JOIN_CODE',
          error: 'That join code does not match the active classroom session.',
        };
      }
    }

    const existing = session.students.find((s) => s.deviceId === cleanDeviceId);
    if (existing) {
      if (params.existingToken && tokensEqual(params.existingToken, existing.tokenHash)) {
        return {
          ok: true,
          student: this.toStudentSelf(existing),
          studentToken: params.existingToken,
          resumed: true,
        };
      }
      return {
        ok: false,
        status: 409,
        code: 'DUPLICATE_PARTICIPATION',
        error: `This device has already joined the active session as "${existing.name}". Duplicate submissions are disabled.`,
      };
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    const newStudent: StoredStudent = {
      id: `stu_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
      sessionId: session.id,
      deviceId: cleanDeviceId,
      tokenHash: hashToken(rawToken),
      name: trimmedName,
      status: 'Joined',
      answers: {},
      joinedAt: now,
      updatedAt: now,
      completedAt: null,
    };

    session.students.push(newStudent);
    await this.persist();

    return {
      ok: true,
      student: this.toStudentSelf(newStudent),
      studentToken: rawToken,
      resumed: false,
    };
  }

  public async getStudentSelf(studentId: string, studentToken: string): Promise<StudentSelfState | null> {
    const student = this.db.activeSession.students.find((s) => s.id === studentId);
    if (!student) return null;
    if (!tokensEqual(studentToken, student.tokenHash)) return null;
    return this.toStudentSelf(student);
  }

  public async saveAnswer(params: {
    studentId: string;
    studentToken: string;
    questionId: string;
    choice: AnswerChoice;
  }): Promise<SaveAnswerResult> {
    if (!VALID_QUESTION_IDS.has(params.questionId)) {
      return { ok: false, status: 400, error: 'Unknown question identifier.' };
    }
    if (params.choice !== 'A' && params.choice !== 'B') {
      return { ok: false, status: 400, error: 'Invalid answer choice.' };
    }

    const student = this.db.activeSession.students.find((s) => s.id === params.studentId);
    if (!student || !tokensEqual(params.studentToken, student.tokenHash)) {
      return { ok: false, status: 401, error: 'Session verification failed. Please rejoin the active poll.' };
    }

    if (student.status === 'Completed') {
      return { ok: false, status: 400, error: 'Responses are locked after submission.' };
    }

    student.answers[params.questionId] = params.choice;
    student.status = 'In Progress';
    student.updatedAt = new Date().toISOString();

    await this.persist();
    return { ok: true, student: this.toStudentSelf(student) };
  }

  public async completeStudent(params: {
    studentId: string;
    studentToken: string;
  }): Promise<CompleteStudentResult> {
    const student = this.db.activeSession.students.find((s) => s.id === params.studentId);
    if (!student || !tokensEqual(params.studentToken, student.tokenHash)) {
      return { ok: false, status: 401, error: 'Session verification failed. Please rejoin the active poll.' };
    }

    if (student.status === 'Completed') {
      return { ok: true, student: this.toStudentSelf(student), newlyCompleted: false };
    }

    const missing = POLL_QUESTIONS.filter(
      (q) => student.answers[q.id] !== 'A' && student.answers[q.id] !== 'B'
    );

    if (missing.length > 0) {
      return {
        ok: false,
        status: 400,
        error: `Please answer all 10 questions before submitting (missing ${missing.map((m) => `Q${m.number}`).join(', ')}).`,
      };
    }

    const now = new Date().toISOString();
    student.status = 'Completed';
    student.completedAt = now;
    student.updatedAt = now;

    await this.persist();
    return { ok: true, student: this.toStudentSelf(student), newlyCompleted: true };
  }

  public async getPublicLiveResults(): Promise<PublicLiveResults> {
    const session = this.db.activeSession;
    const answers: Array<{ studentId: string; questionId: string; choice: AnswerChoice }> = [];
    for (const s of session.students) {
      for (const [questionId, choice] of Object.entries(s.answers)) {
        answers.push({ studentId: s.id, questionId, choice });
      }
    }
    return buildPublicResultsPayload(
      await this.getActiveSessionPublic(),
      session.students.map((s) => ({ id: s.id, status: s.status })),
      answers
    );
  }

  private getSortedTaRecords(): TaStudentRecord[] {
    return [...this.db.activeSession.students]
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        answers: { ...s.answers },
        answeredCount: Object.keys(s.answers).filter((k) => VALID_QUESTION_IDS.has(k)).length,
        joinedAt: s.joinedAt,
        updatedAt: s.updatedAt,
        completedAt: s.completedAt,
      }));
  }

  public async getTaDashboardPayload(): Promise<TaDashboardPayload> {
    return buildTaPayload(await this.getActiveSessionPublic(), this.getSortedTaRecords());
  }

  public async getTaStudentById(studentId: string): Promise<TaStudentRecord | null> {
    const s = this.db.activeSession.students.find((item) => item.id === studentId);
    if (!s) return null;
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      answers: { ...s.answers },
      answeredCount: Object.keys(s.answers).filter((k) => VALID_QUESTION_IDS.has(k)).length,
      joinedAt: s.joinedAt,
      updatedAt: s.updatedAt,
      completedAt: s.completedAt,
    };
  }

  public async buildCsvExport(): Promise<string> {
    return buildCsvString(this.getSortedTaRecords());
  }

  public async startNewSession(label?: string): Promise<SessionPublicInfo> {
    const previous = this.db.activeSession;
    this.db.archivedSessions.unshift(previous);
    if (this.db.archivedSessions.length > 20) {
      this.db.archivedSessions = this.db.archivedSessions.slice(0, 20);
    }
    this.db.activeSession = createFreshLocalSession(label);
    await this.persist();
    return this.getActiveSessionPublic();
  }

  public async resetCurrentSession(): Promise<SessionPublicInfo> {
    this.db.activeSession.students = [];
    this.db.activeSession.createdAt = new Date().toISOString();
    await this.persist();
    return this.getActiveSessionPublic();
  }
}

let cachedStore: VibeStore | null = null;

export function getVibeStore(): VibeStore {
  if (cachedStore) return cachedStore;

  if (isSupabaseConfigured()) {
    cachedStore = new SupabaseVibeStore();
    return cachedStore;
  }

  if (isProductionDeployment()) {
    throw new Error(
      'Supabase database credentials are required in production (VITE_SUPABASE_URL and SUPABASE_SECRET_KEY).'
    );
  }

  cachedStore = new LocalJsonVibeStore();
  return cachedStore;
}
