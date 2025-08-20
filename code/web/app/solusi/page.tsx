"use client";

import Link from "next/link";
import { SOLUTIONS } from "../_utils/solutions";

export default function SolusiListPage() {
  return (
    <main className="min-h-dvh bg-[#E7F1A8] text-[#364C84]">
      <div className="mx-auto max-w-[420px] px-4 py-6">
        <h1 className="text-center text-2xl font-semibold text-[#2F4F90]">
          Bedah<span className="font-extrabold">Gang</span>
        </h1>

        <div className="mt-5 grid grid-cols-2 gap-4">
          {SOLUTIONS.map((s) => (
            <Link
              key={s.id}
              href={`/solusi/${s.id}`}
              className="group rounded-2xl h-40 bg-[#FFFDF5] p-4 shadow-sm ring-1 ring-black/10 hover:shadow-md transition"
            >
              <div className="space-y-2">
                <div className="text-xs text-[#6F7BA6]">{s.kategori}</div>
                <div className="text-[18px] font-semibold leading-snug text-[#2E4270]">
                  {s.name}
                </div>
              </div>
            </Link>
          ))}

          {/* kalau jumlah ganjil, biar spacing bawah tidak jomplang */}
          {SOLUTIONS.length % 2 === 1 && <div aria-hidden className="h-0" />}
        </div>
      </div>
    </main>
  );
}
