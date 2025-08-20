"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SOLUTIONS } from "../../_utils/solutions";
import Panorama from "../../_components/Panorama";

export default function SolusiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);

  const solusi = useMemo(
    () => SOLUTIONS.find((s) => s.id === numId),
    [numId]
  );

  // base path aset (ubah sesuai struktur file kamu)
  const basePath = `/${numId}`;

  if (!solusi) {
    return (
      <main className="min-h-dvh grid place-items-center bg-[#364C84] text-white">
        <div className="text-center">
          <p className="text-lg font-semibold">Solusi tidak ditemukan</p>
          <Link href="/solusi" className="mt-2 inline-block underline">
            Kembali ke daftar solusi
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#364C84] text-[#2E4270]">
      <div className="mx-auto max-w-[420px] px-4 py-6">
        {/* header */}
        <div className="text-center text-white">
          <h1 className="text-2xl font-medium tracking-wide">
            Bedah<span className="font-extrabold">Gang</span>
          </h1>
        </div>

        <div className="relative mt-5 justify-between">
            <div className="m-4 bg-amber-50 rounded-2xl">
                <Link
                href="/solusi"
                className="absolute left-2 top-1 grid h-8 w-8 place-items-center rounded-full text-white"
                aria-label="Kembali"
                title="Kembali"
            >
                ←
            </Link>
            </div>
        
            <div className="mx-6 rounded-2xl bg-[#E7F1A8] px-4 py-3 text-[#2E4270] shadow">
                <div className="text-[12px] opacity-80">{solusi.kategori}</div>
                <div className="text-[16px] font-bold">{solusi.name}</div>
            </div>
        </div>

        <section className="mt-4 rounded-2xl border border-black/10 bg-[#FFFDF5] px-4 py-5 shadow-sm">
          <p className="text-sm leading-relaxed text-black/80">
            {solusi.description}
          </p>

          <div className="mt-4 space-y-5">
            <figure>
              <div className="h-40 w-full rounded-md border border-black/30 bg-[#D9D9D9]">
                <img
                  src={`${basePath}/2d-1.png`}
                  alt="Gambar Potongan"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <figcaption className="mt-1 text-center text-xs text-black/70">
                Gambar Potongan
              </figcaption>
            </figure>

            {/* Denah */}
            <figure>
              <div className="h-40 w-full rounded-md border border-black/30 bg-[#D9D9D9]">
                <img
                  src={`${basePath}/2d-2.png`}
                  alt="Gambar Denah"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <figcaption className="mt-1 text-center text-xs text-black/70">
                Gambar Denah
              </figcaption>
            </figure>
          </div>

          {/* 360 view */}
          <div className="mt-5">
            <h3 className="text-xl font-extrabold text-black">360° View</h3>
            <p className="mt-1 text-xs text-black/70">
              Kamu bisa melihat desain dari berbagai sudut dengan menggeser layar, lalu perbesar atau perkecil tampilan dengan mencubit layar.
            </p>

            <div className="mt-2 rounded-2xl border border-black/30 bg-[#D9D9D9] p-1">
              <Panorama
                src={`${basePath}/panorama.jpg`}
                fov={75}
                className="h-72 w-full rounded-xl"
              />
            </div>
          </div>

          {/* tombol unduh */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="w-64 rounded-full bg-[#2E4270] px-5 py-3 text-sm font-semibold text-white shadow hover:bg-[#273a67] active:scale-[0.99]"
              onClick={() => alert("Hook ke /api/guidebook atau file PDF di sini")}
            >
              Unduh PDF Guidebook
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
