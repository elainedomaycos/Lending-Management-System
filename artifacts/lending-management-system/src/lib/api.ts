const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface LoginResult {
  ok: boolean;
  name?: string;
  error?: string;
}

export async function loginWithPin(pin: string): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<LoginResult>;
  return { ok: res.ok && Boolean(data.ok), name: data.name, error: data.error };
}