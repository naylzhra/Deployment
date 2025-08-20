export type Geo = { lat: number; lng: number; accuracy?: number };

export type AddressParts = {
  alamat?: string;
  kelurahan?: string;
  kecamatan?: string;
  kabupatenKota?: string;
  provinsi?: string;
};

/** Gabung bagian alamat jadi satu string rapi */
export function buildAddressString(addr: AddressParts) {
  return [
    addr.alamat,
    addr.kelurahan && `Kel. ${addr.kelurahan}`,
    addr.kecamatan && `Kec. ${addr.kecamatan}`,
    addr.kabupatenKota,
    addr.provinsi ?? "DKI Jakarta",
    "Indonesia",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Forward‑geocoding via Nominatim (OSM) */
export async function geocodeAddress(q: string): Promise<Geo> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "id");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const r = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      // NOTE: idealnya panggil via server/proxy dan set User‑Agent sendiri
      "User-Agent": "YourAppName/1.0 (contact@example.com)",
    },
  });

  if (!r.ok) throw new Error(`Geocoding gagal (${r.status})`);

  const arr = (await r.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(arr) || arr.length === 0)
    throw new Error("Alamat tidak ditemukan");

  const top = arr[0];
  return { lat: parseFloat(top.lat), lng: parseFloat(top.lon) };
}
