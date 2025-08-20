"use client";
import { useEffect, useState } from "react";
import { fetchWeatherApi } from "openmeteo";

export function useRainProbNow(lat: number, lon: number) {
  const [probNow, setProbNow] = useState<number | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const url = "https://api.open-meteo.com/v1/forecast";
        const params = {
          latitude: lat,
          longitude: lon,
          hourly: "precipitation",
        } as const;

        const [res] = await fetchWeatherApi(url, params);
        const hourly = res.hourly();
        if (!hourly) throw new Error("Hourly block missing");

        const start = Number(hourly.time());     // epoch UTC (sec)
        const end   = Number(hourly.timeEnd());  // epoch UTC (sec)
        const step  = hourly.interval();         // seconds (usually 3600)
        const len   = Math.max(0, Math.floor((end - start) / step));

        const v0 = hourly.variables(0);
        const probArr = v0?.valuesArray?.() ?? null;
        if (!probArr || probArr.length === 0 || len === 0) {
          if (alive) setProbNow(0);
          return;
        }

        const nowUtc = Math.floor(Date.now() / 1000); 
        let idx = Math.floor((nowUtc - start) / step);
        if (idx < 0) idx = 0;
        if (idx >= probArr.length) idx = probArr.length - 1;

        const val = Number(probArr[idx]);
        if (alive) setProbNow(Number.isFinite(val) ? val : 0);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Gagal memuat probabilitas hujan");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [lat, lon]);

  return { probNow, loading, error };
}
