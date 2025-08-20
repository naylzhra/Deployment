"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Address } from "../_utils/types.jsx";

const STORAGE_KEY = "bedahgang";

const LeafletMap = dynamic(() => import("../_components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-2xl bg-slate-200" />
  ),
});

type Geo = { lat: number; lng: number; accuracy?: number };

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

function saveSessionMerge(patch: Partial<{ alamat: Address | null; coords: Geo | null }>) {
  try {
    const prev = loadSession<{ alamat: Address | null; coords: Geo | null }>() ?? {};
    const cleaned = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== null && v !== undefined)
    );
    const next = { ...prev, ...cleaned };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}


function loadSession<T = { alamat: Address | null; coords: Geo | null }>(): T | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function LocationConfirmPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [addr, setAddr] = React.useState<Address | null>(null);
  const [addrLoading, setAddrLoading] = React.useState(false);
  const [addrError, setAddrError] = React.useState<string | null>(null);

  const [coords, setCoords] = React.useState<Geo | null>(null);
  const center = React.useMemo<Geo>(
    () => coords ?? { lat: -6.2, lng: 106.816666 }, 
    [coords]
  );

  React.useEffect(() => {
    const latQ = search.get("lat");
    const lngQ = search.get("lng");
    const accQ = search.get("acc");
    const lat = Number(latQ);
    const lng = Number(lngQ);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setCoords({ lat, lng, accuracy: accQ ? Number(accQ) : undefined });
      return; 
    }

    const saved = loadSession<{ alamat: Address | null; coords: Geo | null }>();
    if (saved) {
      if (saved.coords) setCoords(saved.coords);
      if (saved.alamat) setAddr(saved.alamat);
    }
  }, [search]);

  // Reverse geocoding saat coords berubah
  React.useEffect(() => {
    if (!coords) return;

    const ctrl = new AbortController();
    setAddrLoading(true);
    setAddrError(null);

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(coords.lat));
    url.searchParams.set("lon", String(coords.lng));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "id");

    fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Reverse geocoding gagal (${r.status})`);
        const json = await r.json();
        const parsed = parseOsmAddress(json.address ?? {}, json.display_name);
        setAddr(parsed);
        saveSessionMerge({ alamat: parsed ?? undefined, coords: coords ?? undefined });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setAddrError(String(e.message || e));
      })
      .finally(() => setAddrLoading(false));

    return () => ctrl.abort();
  }, [coords]);

  return (
    <div className="h-dvh bg-white">
      <div className="mx-auto h-full max-w-[360px] overflow-hidden">
        <section className="relative h-[60%] bg-[#D9D9D9]">
          <div className="absolute inset-x-0 top-4 flex justify-center">
            <h1 className="text-2xl font-medium tracking-wide text-[#2F4F90]">
              <span className="text-[#364C84]">Bedah</span>
              <span className="font-bold text-[#364C84]">Gang</span>
            </h1>
          </div>

          <div className="h-[62vh] w-full pt-16 pb-28">
            <LeafletMap center={center} user={coords} />
          </div>

          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white px-4 py-3 shadow">
            {addrLoading && <p className="text-sm text-slate-500">Mengambil alamat…</p>}
            {addrError && <p className="text-sm text-rose-600">{addrError}</p>}
            {!addrLoading && !addrError && (
              <>
                <p className="text-[15px] text-black">
                  {addr ? formatAddressLine(addr) : MOCK_DATA.location.alamat}
                </p>
                <p className="text-sm text-[#535353]">
                  {addr
                    ? `Kel. ${addr.kelurahan ?? "-"}, Kec. ${addr.kecamatan ?? "-"}`
                    : MOCK_DATA.location.kelKec}
                </p>
                <p className="text-sm text-[#535353]">
                  {addr
                    ? `${addr.kabupatenKota ?? "-"}, ${addr.provinsi ?? ""} ${addr.kodePos ?? ""}`
                    : MOCK_DATA.location.kabKota}
                </p>
              </>
            )}
          </div>
        </section>

        <section className="my-auto flex h-[40%] flex-col items-center justify-between px-6">
          <div>
            <p className="mb-1 mt-4 text-center text-sm leading-relaxed text-[#364C84]">
              Lokasimu digunakan untuk menentukan{" "}
              <span className="font-semibold">curah hujan</span> dan{" "}
              <span className="font-semibold">risiko banjir</span> pada area gang yang akan kamu bedah!!
            </p>
            <p className="text-center text-[15px] font-semibold text-[#364C84]">
              Apakah informasi lokasi sudah tepat?
            </p>
          </div>

          <div className="mx-4 mb-auto mt-2 space-y-2">
            <button
              type="button"
              disabled={!addr || addrLoading}
              onClick={() => {
                const alamatForForm = addr ? normalizeForForm(addr) : undefined;
                saveSessionMerge({ alamat: alamatForForm, coords: coords });
                const q = new URLSearchParams(Array.from(search.entries()));
                q.set("step", "2");
                router.push(`/input-gang?${q.toString()}`);
              }}
              className="w-full rounded-full bg-[#364C84] py-3 text-center text-sm font-semibold text-[#FFFDF5]
                         hover:brightness-120 active:brightness-95"
            >
              Ya, sudah tepat!
            </button>

            <button
              type="button"
              disabled={!addr || addrLoading}
              onClick={() => {
                const alamatForForm = addr ? normalizeForForm(addr) : undefined;
                saveSessionMerge({ alamat: alamatForForm, coords: coords });
                const q = new URLSearchParams(Array.from(search.entries()));
                q.set("step", "1");
                router.push(`/input-gang?${q.toString()}`);
              }}
              className="w-full rounded-full bg-[#364C84]/70 py-3 text-center text-sm font-semibold text-[#FFFDF5]
                         hover:brightness-120 active:bg-gray-100"
            >
              Perbaiki lokasi
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------- Utils ------------------------- */
function parseOsmAddress(a: any, displayName?: string): Address {
  const jalan = a.road || a.residential || a.pedestrian || a.footway || a.path;
  const nomor = a.house_number;
  const kelurahan = a.village || a.suburb || a.neighbourhood;
  const kecamatan = a.city_district || a.district || a.suburb;
  const kabupatenKota = a.city || a.town || a.municipality || a.county;
  const provinsi = a.state;
  const kodePos = a.postcode;
  return {
    jalan,
    nomor,
    kelurahan,
    kecamatan,
    kabupatenKota,
    provinsi,
    kodePos,
    full: displayName,
  };
}


// Hasil reverse geocode -> bentuk yang dipakai di step 2
function normalizeForForm(a: Address) {
  const alamatLine = [a.jalan, a.nomor && `No. ${a.nomor}`].filter(Boolean).join(" ");
  return {
    alamat: alamatLine || a.full || "",
    kelurahan: a.kelurahan ?? "",
    kecamatan: a.kecamatan ?? "",
    kabupatenKota: a.kabupatenKota ?? "",
    provinsi: a.provinsi ?? "",
    kodePos: a.kodePos ?? "",
  };
}

function formatAddressLine(a: Address) {
  const jalanLine = [a.jalan, a.nomor && `No. ${a.nomor}`].filter(Boolean).join(" ");
  return jalanLine || a.full || "Alamat tidak ditemukan";
}

export { MOCK_DATA };
export type { PageData, Geo };
