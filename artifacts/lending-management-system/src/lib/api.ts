const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface LoginResult {
  ok: boolean;
  name?: string;
  error?: string;
}

export async function loginWithPin(pin: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
  } catch {
    return { ok: false, error: 'Cannot reach the login service. Check your connection and try again.' };
  }
  const data = (await res.json().catch(() => ({}))) as Partial<LoginResult>;
  if (!res.ok) return { ok: false, error: data.error || 'Cannot reach the login service. Check your connection and try again.' };
  return { ok: Boolean(data.ok), name: data.name, error: data.error };
}