const DEVICE_ID_KEY = 'vibe_check_device_id';
const STUDENT_CRED_KEY = 'vibe_check_student_cred';
const TA_TOKEN_KEY = 'vibe_check_ta_token';

export interface StoredStudentCredentials {
  studentId: string;
  studentToken: string;
  sessionId: string;
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) {
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `dev_${crypto.randomUUID().replace(/-/g, '')}`
        : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function loadStudentCredentials(): StoredStudentCredentials | null {
  try {
    const raw = window.localStorage.getItem(STUDENT_CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredStudentCredentials>;
    if (parsed.studentId && parsed.studentToken && parsed.sessionId) {
      return {
        studentId: parsed.studentId,
        studentToken: parsed.studentToken,
        sessionId: parsed.sessionId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStudentCredentials(creds: StoredStudentCredentials): void {
  try {
    window.localStorage.setItem(STUDENT_CRED_KEY, JSON.stringify(creds));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStudentCredentials(): void {
  try {
    window.localStorage.removeItem(STUDENT_CRED_KEY);
  } catch {
    // Ignore
  }
}

export function loadTaToken(): string | null {
  try {
    return window.sessionStorage.getItem(TA_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveTaToken(token: string): void {
  try {
    window.sessionStorage.setItem(TA_TOKEN_KEY, token);
  } catch {
    // Ignore
  }
}

export function clearTaToken(): void {
  try {
    window.sessionStorage.removeItem(TA_TOKEN_KEY);
  } catch {
    // Ignore
  }
}
