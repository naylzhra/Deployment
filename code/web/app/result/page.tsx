"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Panorama from "../_components/Panorama";
import { useRainProbNow } from "../_components/RainProb";
import { SOLUTIONS } from "../_utils/solutions";
import Link from "next/link";

const STORAGE_KEY = "bedahgang";
const DEFAULT_KELURAHAN = "Duren Sawit";

type RiskResponse = {
  kelurahan: string;
  score?: number | null;
  properties: Record<string, any>;
};

type SavedPayload = {
  coords?: { lat: number; lng: number; accuracy?: number } | null;
  alamat: {
    alamat: string;
    kelurahan: string;
    kecamatan: string;
    kabupatenKota: string;
  };
  lebar: number;
  panjang: number;
  permukaan: string;
  drainase: string;
  aktivitas: string[];
};

type DesignSolutionResponse = any;

const BASE_PRICE_BY_MODULE: Record<string, number> = {
  "1": 4_250_000,
  "2": 2_075_000,
  "3":   316_000,
  "4": 1_172_500,
  "5": 2_200_000,
};

const formatIDR = (n: number) => `Rp.${Math.round(n).toLocaleString("id-ID")},-`;

function scoreToCategory(score?: number | null): string {
  if (score == null) return "-";
  if (score == 0) return "Sangat Rendah";
  if (score <= 2) return "Rendah";
  if (score === 3) return "Sedang";
  if (score === 4) return "Tinggi";
  return "Sangat Tinggi";
}

function boolFromString(x?: string | null) {
  if (!x) return false;
  return true;
}

export default function HasilPage() {
  // gallery state
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const [saved, setSaved] = useState<SavedPayload | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const kelurahan = saved?.alamat?.kelurahan?.trim() || DEFAULT_KELURAHAN;
  const alamat = useMemo(
    () => ({
      line1: saved?.alamat?.alamat?.trim() || "Jl. Melati No. 80",
      line2:
        [
          saved?.alamat?.kelurahan || "Kelurahan",
          saved?.alamat?.kecamatan || "Kecamatan",
          saved?.alamat?.kabupatenKota || "Kabupaten/Kota",
        ]
          .filter(Boolean)
          .join(", "),
    }),
    [saved]
  );

  // Remote data
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [design, setDesign] = useState<DesignSolutionResponse | null>(null);
  const [designErr, setDesignErr] = useState<string | null>(null);
  const [designLoading, setDesignLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/risk?kelurahan=${encodeURIComponent(kelurahan)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`(${res.status}) ${await res.text()}`);
        const data: RiskResponse = await res.json();
        if (alive) setRisk(data);
      } catch (e: any) {
        console.log(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kelurahan]);

  useEffect(() => {
    if (!saved) return;

    const lebar = saved.lebar ?? 0;
    const surface = saved.permukaan || "";
    const drainage = boolFromString(saved.drainase);        
    const activity = (saved.aktivitas ?? []).filter(Boolean);

    const highFloodRisk = (risk?.score ?? 0) >= 4;

    const qs = new URLSearchParams();
    qs.set("lebar", String(lebar));
    qs.set("surface", surface);
    qs.set("drainage", String(drainage));
    qs.set("highFloodRisk", String(highFloodRisk));
    qs.set("activity", activity.join(",")); 

    let alive = true;
    (async () => {
      try {
        setDesignLoading(true);
        setDesignErr(null);
        const res = await fetch(`/api/design-solution?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`(${res.status}) ${await res.text()}`);
        const json = (await res.json()) as DesignSolutionResponse;
        if (alive) setDesign(json);
      } catch (e: any) {
        if (alive) setDesignErr(e?.message ?? "Gagal memuat solusi desain");
      } finally {
        if (alive) setDesignLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [saved, risk]);

  const estimatedCost = useMemo(() => {
    const lebar = Number(saved?.lebar ?? 2.5);
    const panjang = Number(saved?.panjang ?? 100);

    const moduleKey = String(design?.designModule ?? "");
    const base = BASE_PRICE_BY_MODULE[moduleKey] ?? 0;

    const modulesScale = (lebar * panjang) / 5;
    return modulesScale * base;
  }, [saved?.lebar, saved?.panjang, design?.designModule]);


  const [downloading, setDownloading] = useState(false);
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadPdf = async () => {
    try {
      setDownloading(true);

      const moduleNum = String(design?.designModule ?? "1");
      const guidebookUrl = `/${encodeURIComponent(moduleNum)}/guidebook.pdf`; // from public/

      // RAB still generated from API
      const rabReq = fetch(`/api/rab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleNum,
          lebar: saved?.lebar ?? 2.5,
          panjang: saved?.panjang ?? 100,
        }),
      });

      const [guidebookRes, rabRes] = await Promise.all([
        fetch(guidebookUrl, { cache: "no-store" }),
        rabReq,
      ]);

      if (!guidebookRes.ok) {
        const msg = await guidebookRes.text().catch(() => "");
        throw new Error(`Guidebook not found: ${guidebookRes.status} ${msg}`);
      }
      if (!rabRes.ok) {
        const msg = await rabRes.text();
        throw new Error(`RAB failed: ${rabRes.status} ${msg}`);
      }

      const [guidebookBlob, rabBlob] = await Promise.all([
        guidebookRes.blob(),
        rabRes.blob(),
      ]);

      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadBlob(
        guidebookBlob,
        `Guidebook_${kelurahan.replace(/\s+/g, "_")}_${dateTag}.pdf`
      );
      downloadBlob(
        rabBlob,
        `RAB_${kelurahan.replace(/\s+/g, "_")}_${dateTag}.pdf`
      );
    } catch (e: any) {
      alert(e?.message ?? "Gagal mengunduh PDF");
    } finally {
      setDownloading(false);
    }
  };


  const basePath = useMemo(() => {
    const folder = design?.designModule;
    return `${folder}`;
  }, [design]);

  const SLIDES = useMemo(
    () => [
      { src: `${basePath}/2d-1.png`, alt: "Gambar Potongan" },
      { src: `${basePath}/2d-2.png`, alt: "Gambar Denah" },
    ],
    [basePath]
  );

  const { probNow, loading } = useRainProbNow(-6.2, 106.8167);
  

  return (
    <div className="min-h-dvh bg-[#FFFDF5] text-[#364C84]">
      <div className="mx-auto max-w-[420px] px-4 py-6">
        {/* Top banner (hijau muda) */}
        <section className="rounded-t-2xl bg-[#E4F28F] px-6 pt-6 pb-5 text-center">
          <h1 className="text-center text-[20px] font-semibold text-[#364C84]">
            Bedah<span className="text-[20px] font-extrabold">Gang</span>
          </h1>

          {/* Alamat pill */}
          <div className="mt-4 rounded-2xl bg-[#F7F6F2] px-4 py-3 text-[13px] text-[#2E4270] shadow-sm">
            <div className="font-semibold text-[15px] text-black">{alamat.line1}</div>
            <div className="text-[#6F7BA6]">{alamat.line2}</div>
          </div>

          {/* Curah hujan & risiko */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#364C84] px-4 py-3 text-white shadow-sm">
              <div className="text-xs opacity-90">Curah Hujan</div>
              <div className="mt-2 grid place-items-center leading-none">
                <span className="text-4xl font-extrabold tracking-tight">{loading || probNow == null ? "…" : Math.round(probNow)}</span>
                <span className="-mt-0.5 text-sm font-semibold">mm</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="text-xs text-[#6F7BA6]">Risiko Banjir</div>
              <div className="mt-1 text-2xl font-extrabold text-[#2E4270]">
                {scoreToCategory(risk?.score)}
              </div>
              <div className="mt-1 text-[11px] text-[#6F7BA6]">Baca lebih jauh ▾</div>
            </div>
          </div>
        </section>

        {/* Body (krem) */}
        <section className="-mt-2 rounded-[28px] bg-[#FFFDF5] px-5 pb-10 pt-6">
          <p className="mx-auto max-w-[320px] text-center text-[15px]">
            Berdasarkan kondisi Gang-mu, solusi desain yang sesuai adalah
          </p>
          {design?.designModule == "1" && (<h3 className="mt-1 mb-2 text-center text-xl font-bold text-[#2E4270]">
            Permeable Paving + Drainage
          </h3>)}
          {design?.designModule == "2" && (<h3 className="mt-1 mb-2 text-center text-xl font-bold text-[#2E4270]">
            Infiltration Tank
          </h3>)}
          {design?.designModule == "3" && (<h3 className="mt-1 mb-2 text-center text-xl font-bold text-[#2E4270]">
            Mitigation/Signage
          </h3>)}
          {design?.designModule == "4" && (<h3 className="mt-1 mb-2 text-center text-xl font-bold text-[#2E4270]">
            Community Rainwater Harvesting
          </h3>)}
          {design?.designModule == "5" && (<h3 className="mt-1 mb-2 text-center text-xl font-bold text-[#2E4270]">
            Vertical Garden
          </h3>)}

          {designLoading && (
            <div className="mt-3 text-center text-sm text-[#6F7BA6]">Memuat solusi desain…</div>
          )}
          {designErr && (
            <div className="mt-3 text-center text-sm text-rose-600">{designErr}</div>
          )}

          <section className="w-full flex flex-col items-center">
                <div
                  ref={trackRef}
                  className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto
                              touch-pan-x overscroll-x-contain w-full max-w-[360px] mx-auto px-1"
                  style={{ WebkitOverflowScrolling: "touch" }}
                  >
                  {SLIDES.map((s, i) => (
                      <div
                        key={s.src}
                        data-slide={i}
                        className="snap-center basis-[78%] shrink-0"
                      >
                        <div className="h-40 w-80 rounded-2xl border border-[#364C84]/20 bg-white shadow-sm overflow-hidden">
                          <img
                            src={s.src}
                            alt={s.alt}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    ))}
                </div>

                {/* Dots */}
                <div className="mt-2 flex items-center justify-center gap-1.5">
                {SLIDES.map((_, i) => (
                    <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${idx === i ? "bg-[#364C84]" : "bg-[#364C84]/30"}`}
                    />
                ))}
                </div>
            </section>

          {/* Description + Read more */}
          <ReadMore className="mx-auto mt-3 max-w-[340px] text-center text-[13px] text-black">
            {SOLUTIONS[design?.designModule - 1]?.description}
          </ReadMore>

          <div className="mt-5 rounded-2xl bg-[#D9D9D9] p-3 shadow-sm">
            <div className="relative grid h-72 w-full place-items-center rounded-xl bg-[#D9D9D9] text-sm text-black/70">
              <Panorama
                src= {`${basePath}/panorama.jpg`}
                fov={75}
                autorotate={false}   
                autorotateSpeed={0.2}
                className="w-full h-72 rounded-2xl"
              />
            </div>
          </div>

          <p className="mt-6 text-center text-[13px] text-[#2E4270]">
            Untuk mewujudkan desain ini pada gang-mu, estimasi biaya yang harus kamu keluarkan adalah sebesar
          </p>
          <p className="mt-6 text-center font-bold text-[20px] text-[#2E4270]">
            {estimatedCost > 0 ? formatIDR(estimatedCost) : "Rp.316.000,-"}
          </p>
          <p className="mt-6 text-center text-[13px] text-[#2E4270]">
            dengan rincian anggaran, material, dan gambar kerja yang dapat kamu akses melalui tombol di bawah ini!
          </p>
          <div className="mt-3 flex justify-center">
            <button
              onClick={onDownloadPdf}
              disabled={downloading}
              className="w-60 rounded-full bg-[#2E4270] px-5 py-3 text-sm font-semibold text-white shadow hover:bg-[#273a67] active:scale-[0.99] disabled:opacity-60"
            >
              {downloading ? "Menyiapkan…" : "Unduh PDF Guidebook"}
            </button>
          </div>
        </section>
        
      <section className="mt-8 border bg-gradient-to-b from-[#D7F08C] via-[#A9CC9E] to-[#1F3361] p-4 text-white shadow-lg">
        <div className="bg-gradient-to-b from-transparent to-black/10 p-4">
          <h3 className="text-[18px] leading-snug font-semibold">
            Ingin mempelajari <em>tool kit</em> desain <span className="font-extrabold">BedahGang</span> lainnya?
          </h3>

          <p className="mt-2 text-[12.5px] leading-relaxed text-white/90">
            Inisiatif ini dimulai dengan riset dan pengolahan data untuk merumuskan strategi desain yang tepat.
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/90">
            <span className="font-semibold">Setiap desain yang kami tawarkan hanyalah salah satu dari banyak kemungkinan</span> yang dapat diwujudkan di gang‑mu!
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/solusi"
              className="group rounded-2xl bg-gradient-to-b from-[#A8B8F6] to-[#5977C8] p-4 text-left shadow-[0_10px_22px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            >
              <div className="text-white text-[18px] font-bold leading-tight drop-shadow">
                Pelajari<br/><span className="italic font-semibold">Tool Kit</span>
              </div>
            </Link>

            <Link
              href="/about"
              className="group rounded-2xl bg-gradient-to-b from-[#89A6E3] to-[#3D5C9A] p-4 text-left shadow-[0_10px_22px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            >
              <div className="text-white text-[18px] font-bold leading-tight drop-shadow">
                Kenali<br/><span className="font-extrabold">BedahGang</span>
              </div>
            </Link>
          </div>
        </div>  
      </section>          
      </div>
    </div>
  );
}

function ReadMore({
  children,
  className,
  initialLines = 2,
}: {
  children: React.ReactNode;
  className?: string;
  initialLines?: number;
}) {
  const [open, setOpen] = useState(false);

  const clampStyle = !open
    ? ({
        display: "-webkit-box",
        WebkitLineClamp: initialLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      } as React.CSSProperties)
    : undefined;

  return (
    <div className={className}>
      <p style={clampStyle}>{children}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto mt-1 block rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-[#2E4270]"
      >
        {open ? "Tutup" : "Baca lebih jauh ▾"}
      </button>
    </div>
  );
}
