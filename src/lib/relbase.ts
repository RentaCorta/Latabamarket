import { getValidToken } from "./relbase-tokens";

const API_BASE = process.env.RELBASE_API_BASE!;

// Llama a cualquier endpoint de relBase con un token siempre válido.
export async function relbaseFetch(path: string) {
  const token = await getValidToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`relBase ${res.status} en ${path}: ${detail}`);
  }
  return res.json();
}