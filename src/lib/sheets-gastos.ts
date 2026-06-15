// Lee la hoja de gastos (honorarios + sueldos + impuestos) publicada como CSV
// y la entrega normalizada para el dashboard.

const CSV_URL = process.env.GASTOS_SHEET_CSV_URL!;

export interface Gasto {
  fecha: string;
  tipo: string;            // 'honorario' | 'sueldo' | 'impuesto'
  rut: string;
  nombre: string;
  glosa: string;
  monto_bruto: number;
  retencion_descuentos: number;
  monto_liquido: number;
  periodo: string;         // 'YYYY-MM'
}

// Parser CSV simple que respeta comillas (por si una glosa lleva comas)
function parseCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let dentroComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const siguiente = texto[i + 1];

    if (c === '"') {
      if (dentroComillas && siguiente === '"') { campo += '"'; i++; }
      else dentroComillas = !dentroComillas;
    } else if (c === "," && !dentroComillas) {
      fila.push(campo); campo = "";
    } else if ((c === "\n" || c === "\r") && !dentroComillas) {
      if (campo !== "" || fila.length > 0) { fila.push(campo); filas.push(fila); }
      campo = ""; fila = [];
      if (c === "\r" && siguiente === "\n") i++;
    } else {
      campo += c;
    }
  }
  if (campo !== "" || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas;
}

function aNumero(v: string): number {
  if (!v) return 0;
  const limpio = v.replace(/[^\d-]/g, "");
  return Number(limpio) || 0;
}

// Normaliza una fecha a formato YYYY-MM-DD.
// Acepta: "2026-05-15", "15-05-2026", "15/05/2026", "5-5-2026"
function normalizarFecha(v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "";

  // Ya viene en formato ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Separa por - o /
  const partes = s.split(/[-/]/).map((p) => p.trim());
  if (partes.length !== 3) return s;

  // Si la primera parte tiene 4 dígitos, es YYYY-MM-DD o YYYY/MM/DD
  if (partes[0].length === 4) {
    const [y, m, d] = partes;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Si no, asumimos DD-MM-YYYY (formato chileno)
  const [d, m, y] = partes;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export async function obtenerGastos(): Promise<Gasto[]> {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo leer la hoja: ${res.status}`);

  const texto = await res.text();
  const filas = parseCSV(texto);
  if (filas.length < 2) return [];

  const encabezados = filas[0].map((h) => h.trim().toLowerCase());
  const idx = (nombre: string) => encabezados.indexOf(nombre);

  const iFecha = idx("fecha");
  const iTipo = idx("tipo");
  const iRut = idx("rut");
  const iNombre = idx("nombre");
  const iGlosa = idx("glosa");
  const iBruto = idx("monto_bruto");
  const iRet = idx("retencion_descuentos");
  const iLiquido = idx("monto_liquido");
  const iPeriodo = idx("periodo");

  const gastos: Gasto[] = [];
  for (let f = 1; f < filas.length; f++) {
    const fila = filas[f];
    if (!fila[iNombre] && !fila[iBruto]) continue;

    gastos.push({
      fecha: normalizarFecha(fila[iFecha] ?? ""),
      tipo: (fila[iTipo] ?? "").trim().toLowerCase(),
      rut: (fila[iRut] ?? "").trim(),
      nombre: (fila[iNombre] ?? "").trim(),
      glosa: (fila[iGlosa] ?? "").trim(),
      monto_bruto: aNumero(fila[iBruto] ?? ""),
      retencion_descuentos: aNumero(fila[iRet] ?? ""),
      monto_liquido: aNumero(fila[iLiquido] ?? ""),
      periodo: (fila[iPeriodo] ?? "").trim(),
    });
  }
  return gastos;
}

// Resumen agregado para el dashboard, filtrado por rango de fechas
export async function resumenGastos(from?: string, to?: string) {
  const todos = await obtenerGastos();

  const filtrados = todos.filter((g) => {
    if (!g.fecha) return false;
    if (from && g.fecha < from) return false;
    if (to && g.fecha > to) return false;
    return true;
  });

  const honorarios = filtrados.filter((g) => g.tipo === "honorario");
  const sueldos = filtrados.filter((g) => g.tipo === "sueldo");
  const impuestos = filtrados.filter((g) => g.tipo === "impuesto");

  const sumar = (arr: Gasto[], campo: keyof Gasto) =>
    arr.reduce((acc, g) => acc + (Number(g[campo]) || 0), 0);

  return {
    rango: { from: from ?? null, to: to ?? null },
    honorarios: {
      cantidad: honorarios.length,
      total_bruto: sumar(honorarios, "monto_bruto"),
      total_liquido: sumar(honorarios, "monto_liquido"),
    },
    sueldos: {
      cantidad: sueldos.length,
      total_bruto: sumar(sueldos, "monto_bruto"),
      total_liquido: sumar(sueldos, "monto_liquido"),
    },
    impuestos: {
      cantidad: impuestos.length,
      total: sumar(impuestos, "monto_bruto"),
    },
    total_gastos_personal: sumar([...honorarios, ...sueldos], "monto_bruto"),
    total_impuestos: sumar(impuestos, "monto_bruto"),
    detalle: filtrados,
  };
}