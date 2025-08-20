import { useEffect, useMemo, useState } from "react";

export function normalizeKey(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

type CsvRow = { provinsi: string; kota: string; kecamatan: string; kelurahan: string };

function splitCSVLine(line: string) {
  const delim = line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(delim).map((c) => c.trim());
}

function normVal(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function parseCSV(csv: string): CsvRow[] {
  const lines = csv.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(normalizeKey);

  const idxProv = headers.findIndex((h) => /provinsi/.test(h));
  const idxKota = headers.findIndex((h) =>
    /(kota\/kabupaten|kotakabupaten|kabupatenkota|kota|kabupaten)/.test(h)
  );
  const idxKec = headers.findIndex((h) => /kecamatan/.test(h));
  const idxKel = headers.findIndex((h) => /kelurahan|desa/.test(h));

  let lastProv = "";
  let lastKota = "";
  let lastKec = "";

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);

    const prov = idxProv >= 0 ? cols[idxProv] : "";
    const kota = idxKota >= 0 ? cols[idxKota] : "";
    const kec = idxKec >= 0 ? cols[idxKec] : "";
    const kel = idxKel >= 0 ? cols[idxKel] : "";

    if (prov) lastProv = prov;
    if (kota) lastKota = kota;
    if (kec) lastKec = kec;

    const provF = lastProv;
    const kotaF = lastKota;
    const kecF = lastKec;

    if (provF && kotaF && kecF && kel) {
      rows.push({
        provinsi: normVal(provF),
        kota: normVal(kotaF),
        kecamatan: normVal(kecF),
        kelurahan: normVal(kel),
      });
    }
  }
  return rows;
}

export function unique(arr: string[]) {
  return Array.from(new Set(arr.map(normVal))).sort((a, b) => a.localeCompare(b, "id"));
}

export function useDkiOptions() {
  const [all, setAll] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/data/daerah_dki.csv", { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`Gagal mengambil CSV (${r.status})`);
        return r.text();
      })
      .then((txt) => {
        if (!alive) return;
        const parsed = parseCSV(txt);
        console.log("[CSV] rows:", parsed.length, parsed.slice(0, 10));
        setAll(parsed);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e.message || e));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const kotaList = useMemo(() => unique(all.map((r) => r.kota)), [all]);

  function kecamatanList(kota?: string) {
    if (!kota) return [];
    const k = normVal(kota);
    return unique(all.filter((r) => r.kota === k).map((r) => r.kecamatan));
  }

  function kelurahanList(kota?: string, kecamatan?: string) {
    if (!kota || !kecamatan) return [];
    const k = normVal(kota);
    const c = normVal(kecamatan);
    return unique(all.filter((r) => r.kota === k && r.kecamatan === c).map((r) => r.kelurahan));
  }

  return { loading, error, kotaList, kecamatanList, kelurahanList };
}
