"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { buildAddressString, geocodeAddress, type AddressParts, type Geo, } from "../_utils/geocode";
import { useDkiOptions } from "../_utils/read_kelurahan"; 

const LeafletMap = dynamic(() => import("../_components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-2xl bg-slate-200" />
  ),
});

const STORAGE_KEY = "bedahgang";

type PageData = {
  location: { alamat: string; kelKec: string; kabKota: string };
  routes: { confirmPath: string; fixPath: string };
};

const MOCK_DATA: PageData = {
  location: {
    alamat: "Jl. Melati No. 80",
    kelKec: "Kelurahan, Kecamatan",
    kabKota: "Kabupaten/Kota",
  },
  routes: { confirmPath: "/input-gang?step=2", fixPath: "/input-gang?step=1" },
};

/* ---------- Types & constants ---------- */
type Permukaan = "beton" | "aspal" | "tanah";
type Drainase = "ada" | "tidak ada";
const LEBAR_OPTS = [1, 1.5, 2, 2.5] as const;
const PANJANG_OPTS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
const AKTIVITAS = ["Aktivitas Sosial", "Aktivitas Komersial", "Jalur Kendaraan", "Jalur Pejalan Kaki"] as const;
const ACTIVITY_CODES = ["sosial", "komersial", "pejalan", "kendaraan"] as const;
export type ActivityCode = typeof ACTIVITY_CODES[number];

const ACTIVITY_OPTIONS: ReadonlyArray<{ label: string; value: ActivityCode }> = [
  { label: "Aktivitas Sosial",     value: "sosial" },
  { label: "Aktivitas Komersial",  value: "komersial" },
  { label: "Jalur Pejalan Kaki",   value: "pejalan" },
  { label: "Jalur Kendaraan",      value: "kendaraan" },
];

const labelToCode: Record<string, ActivityCode> = {
  "Aktivitas Sosial": "sosial",
  "Aktivitas Komersial": "komersial",
  "Jalur Pejalan Kaki": "pejalan",
  "Jalur Kendaraan": "kendaraan",
};
const isActivityCode = (v: any): v is ActivityCode =>
  typeof v === "string" && (ACTIVITY_CODES as readonly string[]).includes(v);



function saveSession(payload: any) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function loadSession<T = any>(): T | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function BedahGangPage() {
  const router = useRouter();
  const search = useSearchParams();

  // Shared state across steps
  const [addr, setAddr] = useState({
    alamat: "",
    kelurahan: "",
    kecamatan: "",
    kabupatenKota: "",
  });
  
  const { loading: optLoading, error: optError, kotaList, kecamatanList, kelurahanList } = useDkiOptions();

  const kecList = useMemo(() => kecamatanList(addr.kabupatenKota), [addr.kabupatenKota, kecamatanList]);
  const kelList = useMemo(() => kelurahanList(addr.kabupatenKota, addr.kecamatan), [addr.kabupatenKota, addr.kecamatan, kelurahanList]);


  const initialStep = Number(search.get("step")) === 2 ? 2 : 1;
  const [step, setStep] = useState<1 | 2>(initialStep);

  const latQ = search.get("lat");
  const lngQ = search.get("lng");
  const accQ = search.get("acc");

    const coords: Geo | null = useMemo(() => {
    if (!latQ || !lngQ) return null;
    const lat = Number(latQ);
    const lng = Number(lngQ);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const accuracy = accQ ? Number(accQ) : undefined;
    return { lat, lng, accuracy };
  }, [latQ, lngQ, accQ]);

  const center: Geo = useMemo(
    () => coords ?? { lat: -6.2, lng: 106.816666 },
    [coords]
  );

  useEffect(() => {
    const qp = new URLSearchParams(Array.from(search.entries()));
    qp.set("step", String(step));
    router.replace(`?${qp.toString()}`, { scroll: false });
  }, [step]);

  const [lebarIdx, setLebarIdx] = useState(0);
  const [panjangIdx, setPanjangIdx] = useState(0);
  const [permukaan, setPermukaan] = useState<Permukaan>("beton");
  const [drainase, setDrainase] = useState<Drainase>("tidak ada");
  const [aktivitas, setAktivitas] = useState<Set<ActivityCode>>(new Set());

  const lebarLabel = useMemo(() => `${LEBAR_OPTS[lebarIdx].toFixed(1)} m`, [lebarIdx]);
    useEffect(() => {
    const saved = loadSession<any>();
    if (!saved) return;

    if (saved.alamat) {
      setAddr({
        alamat: saved.alamat.alamat ?? "",
        kelurahan: saved.alamat.kelurahan ?? "",
        kecamatan: saved.alamat.kecamatan ?? "",
        kabupatenKota: saved.alamat.kabupatenKota ?? "",
      });
    }
    if (typeof saved.lebar === "number") {
      const idx = LEBAR_OPTS.findIndex((v) => v === saved.lebar);
      if (idx >= 0) setLebarIdx(idx);
    }
    if (saved.permukaan) setPermukaan(saved.permukaan);
    if (saved.drainase) setDrainase(saved.drainase);
    if (Array.isArray(saved.aktivitas)) {
      const normalized: ActivityCode[] = saved.aktivitas
        .map((x: string) => (isActivityCode(x) ? x : labelToCode[x]))
        .filter(Boolean) as ActivityCode[];
      setAktivitas(new Set<ActivityCode>(normalized));
    }
  }, []);

    const panjangLabel = useMemo(() => `${PANJANG_OPTS[panjangIdx].toFixed(1)} m`, [panjangIdx]);
      useEffect(() => {
      const saved = loadSession<any>();
      if (!saved) return;

      if (saved.alamat) {
        setAddr({
          alamat: saved.alamat.alamat ?? "",
          kelurahan: saved.alamat.kelurahan ?? "",
          kecamatan: saved.alamat.kecamatan ?? "",
          kabupatenKota: saved.alamat.kabupatenKota ?? "",
        });
      }
      if (typeof saved.panjang === "number") {
        const idx = PANJANG_OPTS.findIndex((v) => v === saved.panjang);
        if (idx >= 0) setPanjangIdx(idx);
      }
      if (saved.permukaan) setPermukaan(saved.permukaan);
      if (saved.drainase) setDrainase(saved.drainase);
      if (Array.isArray(saved.aktivitas)) {
        const normalized: ActivityCode[] = saved.aktivitas
          .map((x: string) => (isActivityCode(x) ? x : labelToCode[x]))
          .filter(Boolean) as ActivityCode[];
        setAktivitas(new Set<ActivityCode>(normalized));
      }
    }, []);

  function toggleAkt(k: ActivityCode) {
    setAktivitas((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function submitAddress(e: FormEvent) {
    e.preventDefault();
    if (!addr.kabupatenKota || !addr.kecamatan || !addr.kelurahan) {
      alert("Pilih Kabupaten/Kota, Kecamatan, dan Kelurahan terlebih dahulu.");
      return;
    }

    saveSession({
      ...(loadSession() ?? {}),
      coords,
      alamat: addr,
    });

    setStep(2);
  }

  function submitDimensi(e: FormEvent) {
    e.preventDefault();
    const payload = {
      alamat: addr,
      lebar: LEBAR_OPTS[lebarIdx],
      panjang: PANJANG_OPTS[panjangIdx],
      permukaan,
      drainase,
      aktivitas: Array.from(aktivitas),
    };
    saveSession(payload);
    console.log("Final payload =>", payload);
    router.push("/result");
  }

  return (
    <div className="min-h-dvh bg-[#364C84] text-slate-900">
      <div className="mx-auto max-w-[420px] px-4 py-6">
        <div className="rounded-2xl bg-[#364C84] ring- ">
          {/* Header */}
          <div className="rounded-t-2xl bg-[#364C84] px-6 pt-6 pb-5 text-center">
            <h1 className="text-xl font-semibold tracking-wide text-white">
              Bedah<span className="font-extrabold">Gang</span>
            </h1>
            <Stepper step={step} />
          </div>

          {/* Body wrapper */}
          <div className="pb-6">
            {step === 1 ? (
              <div className="mx-3 rounded-2xl bg-[#FFFDF5] px-5 py-5">
                <form onSubmit={submitAddress}>
                  <div className="rounded-2xl border border-slate-200 bg-slate-200/60 p-3 h-[24vh] w-full">
                    <LeafletMap center={center} user={coords} zoomWhenUser={16} />
                  </div>

                  {/* Address fields */}
                  <div className="mt-5 space-y-4">

                    {/* CSV status (optional) */}
                    {optLoading && <div className="mt-2 text-xs text-slate-600">Memuat daftar wilayah…</div>}
                    {optError && <div className="mt-2 text-xs text-rose-600">{optError}</div>}

                    {/* Dropdown: Kabupaten/Kota */}
                    <SelectField
                      label="Kabupaten/Kota"
                      value={addr.kabupatenKota}
                      onChange={(v) => {
                        setAddr((a) => ({
                          ...a,
                          kabupatenKota: v,
                          // reset child selections when parent changes
                          kecamatan: "",
                          kelurahan: "",
                        }));
                      }}
                      options={[{ label: "Pilih…", value: "" }, ...kotaList.map((k) => ({ label: k, value: k }))]}
                    />

                    {/* Dropdown: Kecamatan (depends on Kab/Kota) */}
                    <SelectField
                      className="mt-4"
                      label="Kecamatan"
                      value={addr.kecamatan}
                      onChange={(v) => {
                        setAddr((a) => ({ ...a, kecamatan: v, kelurahan: "" }));
                      }}
                      options={[{ label: "Pilih…", value: "" }, ...kecList.map((k) => ({ label: k, value: k }))]}
                      // disable until a Kab/Kota selected
                      disabled={!addr.kabupatenKota}
                    />

                    {/* Dropdown: Kelurahan (depends on Kecamatan) */}
                    <SelectField
                      className="mt-4"
                      label="Kelurahan"
                      value={addr.kelurahan}
                      onChange={(v) => setAddr((a) => ({ ...a, kelurahan: v }))}
                      options={[{ label: "Pilih…", value: "" }, ...kelList.map((k) => ({ label: k, value: k }))]}
                      disabled={!addr.kecamatan}
                    />

                    {/* Alamat detail tetap input bebas */}
                    <Field
                      label="Alamat"
                      placeholder="Jl. Melati No. 80"
                      value={addr.alamat}
                      onChange={(v) => setAddr((a) => ({ ...a, alamat: v }))}
                    />

                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      type="submit"
                      className="mt-6 w-60 rounded-full bg-[#364C84] px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#344C90] active:scale-[0.99]"
                    >
                      Konfirmasi Alamat
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* --- Step 2 (Dimensi Gang) --- */
            <>
              <div className="mx-3 rounded-xl text-white px-4 py-3 bg-white/50 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="text-left">
                    <div className="text-sm font-semibold leading-tight">
                      {addr.alamat || "Jl. Melati No. 80"}
                    </div>
                    <div className="text-xs opacity-90">
                      {addr.kelurahan || "Kelurahan"}, {addr.kecamatan || "Kecamatan"}
                      <br />
                      {addr.kabupatenKota || "Kabupaten/Kota"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="ml-3 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#2E4270] hover:bg-white"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="mx-3 mt-3 rounded-2xl bg-[#FFFDF5] px-5 py-5">
                <form onSubmit={submitDimensi}>
                  <div className="mt-2 flex justify-between gap-3">
                    <div className="flex flex-col">
                      <label className="mt-1 block text-sm font-medium text-[#2E4270]">
                        Lebar Gang
                      </label>
                      <div className="flex">
                        <RoundBtn
                          label="Kurangi lebar"
                          disabled={lebarIdx === 0}
                          onClick={() => setLebarIdx((i) => Math.max(i - 1, 0))}
                        >
                          –
                        </RoundBtn>

                        <div className="flex-1 rounded-full border border-[#2E4270]/40 bg-white px-5 py-2 text-center text-sm font-medium text-slate-700 mx-1">
                          {lebarLabel}
                        </div>

                        <RoundBtn
                          label="Tambah lebar"
                          disabled={lebarIdx === LEBAR_OPTS.length - 1}
                          onClick={() =>
                            setLebarIdx((i) => Math.min(i + 1, LEBAR_OPTS.length - 1))
                          }
                        >
                          +
                        </RoundBtn>
                      </div>
                    </div>
                    <div className="flex flex-col">
                       <label className="mt-1 block text-sm font-medium text-[#2E4270]">
                          Panjang Gang
                        </label>  
                      <div className="flex">
                        <RoundBtn
                          label="Kurangi panjang"
                          disabled={panjangIdx === 0}
                          onClick={() => setPanjangIdx((i) => Math.max(i - 1, 0))}
                        >
                          –
                        </RoundBtn>

                        <div className="flex-1 rounded-full border border-[#2E4270]/40 bg-white px-5 py-2 text-center text-sm font-medium text-slate-700 mx-1">
                          {panjangLabel}
                        </div>

                        <RoundBtn
                          label="Tambah panjang"
                          disabled={panjangIdx === PANJANG_OPTS.length - 1}
                          onClick={() =>
                            setPanjangIdx((i) => Math.min(i + 1, PANJANG_OPTS.length - 1))
                          }
                        >
                          +
                        </RoundBtn>
                      </div>
                    </div>
                  </div>

                  {/* Dropdowns */}
                  <SelectField
                    className="mt-5"
                    label="Permukaan Jalan"
                    value={permukaan}
                    onChange={(v) => setPermukaan(v as Permukaan)}
                    options={[
                      { label: "Beton", value: "beton" },
                      { label: "Aspal", value: "aspal" },
                      { label: "Tanah", value: "tanah" },
                    ]}
                  />

                  <SelectField
                    className="mt-4"
                    label="Drainase"
                    value={drainase}
                    onChange={(v) => setDrainase(v as Drainase)}
                    options={[
                      { label: "Ada", value: "true" },
                      { label: "Tidak ada", value: "" },
                    ]}
                  />

                  {/* Aktivitas */}
                  <div className="mt-5">
                    <div className="text-sm font-medium text-[#2E4270]">Penggunaan Gang</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {ACTIVITY_OPTIONS.map((opt) => {
                        const active = aktivitas.has(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleAkt(opt.value)}
                            className={[
                              "h-20 rounded-xl border text-xs capitalize transition",
                              active
                                ? "border-[#3A54A0] bg-[#3A54A0]/10 font-semibold text-[#2E4270]"
                                : "border-slate-300 bg-slate-200 text-slate-600",
                            ].join(" ")}
                            aria-pressed={active}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      type="submit"
                      className="mt-6 w-60 rounded-full bg-[#3A54A0] px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#344C90] active:scale-[0.99]"
                      onClick={ () => router.push("/result") }
                    >
                      Konfirmasi Dimensi Gang
                    </button>
                  </div>
                </form>
              </div>
            </>

            )}
          </div>

          {/* bottom radius spacer */}
          <div className="h-3 rounded-b-2xl bg-[#364C84]" />
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const circleCls = (active: boolean) =>
    [
      "grid h-6 w-6 place-items-center rounded-full ring-2 transition-all duration-300",
      active
        ? "scale-110 bg-white text-[#2E4270] ring-white"
        : "bg-white/30 text-white ring-white/40",
    ].join(" ");

  return (
    <div className="mt-5 grid grid-cols-[auto,1fr,auto] grid-rows-[auto,auto] items-center justify-items-center gap-x-1 text-xs text-slate-200">
      {/* circles + connector */}
      <span className={circleCls(step === 1)} style={{ gridColumn: 1, gridRow: 1 }}>
        1
      </span>

      <div
        className="relative h-0.5 w-40 overflow-hidden rounded-full -mx-px bg-white/30"
        style={{ gridColumn: 2, gridRow: 1 }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-white transition-[width] duration-500 ease-out"
          style={{ width: step === 1 ? "0%" : "100%" }}
        />
      </div>

      <span className={circleCls(step === 2)} style={{ gridColumn: 3, gridRow: 1 }}>
        2
      </span>

      {/* labels */}
      <div className="p-2 text-center" style={{ gridColumn: 1, gridRow: 2 }}>
        <div className="font-medium text-white/90">Step 1</div>
        <div className="text-[10px] opacity-80">Alamat</div>
      </div>
      <div className="text-center" style={{ gridColumn: 3, gridRow: 2 }}>
        <div className="font-medium text-white/90">Step 2</div>
        <div className="text-[10px] opacity-80">Dimensi Gang</div>
      </div>
    </div>
  );
}

/* ---------- Reusable UI ---------- */
function Field(props: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { label, placeholder, value, onChange } = props;
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label htmlFor={id} className="block">
      <div className="mb-1 text-sm font-medium text-[#2E4270]">{label}</div>
      <input
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-[#2E4270]/40 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2E4270] focus:ring-2 focus:ring-[#2E4270]/30"
        autoComplete="off"
      />
    </label>
  );
}

function RoundBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full border border-[#2E4270]/40 bg-white text-lg leading-none text-[#2E4270] transition disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SelectField(props: {
  className?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  disabled?: boolean;
}) {
  const id = props.label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={props.className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[#2E4270]">
        {props.label}
      </label>

      <div className="relative">
        <select
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          disabled={props.disabled}
          className="w-full appearance-none rounded-full border border-[#2E4270]/40 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 outline-none focus:border-[#2E4270] focus:ring-2 focus:ring-[#2E4270]/30 disabled:opacity-60"
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 opacity-70">
          <path d="M5 7l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
