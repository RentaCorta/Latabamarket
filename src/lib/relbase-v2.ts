import { getValidV2Token } from "./relbase-v2-tokens";

const API_BASE = "https://api.relbase.cl/api/v2";

interface RelbaseError {
  meta?: { code?: number; message?: string; debug_info?: string };
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: BodyInit;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

// Helper para llamar la API v2 con token válido y manejo de errores estructurado.
// Maneja refresh automático y reintento ante 401.
export async function relbaseV2Fetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const callOnce = async (): Promise<Response> => {
    const token = await getValidV2Token();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    };
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
    return fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body,
    });
  };

  let res = await callOnce();

  // Si el token fue revocado entre que lo leímos y lo usamos, reintentamos una vez
  // (el getValidV2Token interno hará refresh si llegó a expirar)
  if (res.status === 401) {
    res = await callOnce();
  }

  if (!res.ok) {
    let errMsg = `Relbase v2 ${res.status} en ${path}`;
    try {
      const errData: RelbaseError = await res.json();
      if (errData.meta?.debug_info) errMsg += `: ${errData.meta.debug_info}`;
      else if (errData.meta?.message) errMsg += `: ${errData.meta.message}`;
    } catch {
      const txt = await res.text();
      if (txt) errMsg += `: ${txt}`;
    }
    throw new Error(errMsg);
  }

  return res.json();
}