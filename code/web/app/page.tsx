"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAP_PAGE = "/confirm-location"; 

const SLIDES = [
  { src: "/landing-page/1.png", alt: "Slide 1" },
  { src: "/landing-page/3.png", alt: "Slide 3" },
  { src: "/landing-page/4.png", alt: "Slide 4" },
  { src: "/landing-page/5.png", alt: "Slide 5" },
];

export default function LandingPage() {
  const router = useRouter();

  // gallery state
  const trackRef = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0);

  // permission modal
  const [askOpen, setAskOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // compute current slide index (based on item width)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const step = () => {
      const item = el.querySelector<HTMLElement>("[data-slide='0']");
      const itemW = item?.offsetWidth ?? el.clientWidth;
      const gap = parseInt(getComputedStyle(el).columnGap || "16", 10);
      const stepSize = itemW + gap;
      const i = Math.round(el.scrollLeft / stepSize);
      setIdx(Math.max(0, Math.min(SLIDES.length - 1, i)));
    };

    const handler = () => requestAnimationFrame(step);
    el.addEventListener("scroll", handler, { passive: true });
    step();

    return () => el.removeEventListener("scroll", handler);
  }, []);

  function onStart() {
    setErrorMsg(null);
    setAskOpen(true);
  }

  function requestLocation() {
    setRequesting(true);
    setErrorMsg(null);

    if (!("geolocation" in navigator)) {
      setRequesting(false);
      setErrorMsg("Perangkat/browser tidak mendukung geolokasi.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const q = new URLSearchParams({
          lat: String(latitude),
          lng: String(longitude),
          acc: String(Math.round(accuracy ?? 0)),
        }).toString();
        router.push(`${MAP_PAGE}?${q}`);
      },
      (err) => {
        setRequesting(false);
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Anda bisa mengaktifkannya di pengaturan browser."
            : err.message
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  return (
    <div className="min-h-dvh bg-[#FFFDF5] text-[#364C84]">
        <div className="mx-auto max-w-[420px] px-4 py-4 min-h-dvh flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">
                <span>Bedah</span><span className="font-extrabold">Gang</span>
            </h1>
            <select
                className="rounded-lg border border-[#364C84]/20 bg-white px-3 py-1 text-xs"
                defaultValue="id"
                aria-label="Language"
            >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
            </select>
            </header>

            <main className="flex flex-1 flex-col items-center justify-center gap-6 my-25">
            {/* Hero text */}
            <section className="text-center">
                <p className="text-[18px] font-semibold leading-snug">
                Kamu bisa memulai perubahan untuk lingkunganmu melalui <span className="font-extrabold">BedahGang</span>!
                </p>
                <p className="mt-2 text-sm text-[#465a96]/90">
                Permasalahan banjir di Jakarta berakar dari berbagai faktor yang kompleks, tetapi
                <span className="font-semibold"> BedahGang </span>
                akan membantu kamu memahaminya dan memperbaikinya.
                </p>
            </section>

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
                        className="snap-center basis-[85%] shrink-0"
                      >
                        <div className="h-48 w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#364C84]/20">
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

            {/* Button mulai */}
            <section className="w-full flex justify-center">
                <button
                onClick={onStart}
                className="w-full max-w-[320px] rounded-full bg-[#E4F28F] py-3 text-sm font-semibold text-[#364C84] shadow-sm hover:brightness-105 active:brightness-95"
                >
                Mulai <span className="font-extrabold">BedahGang</span>!
                </button>
            </section>
            </main>

            {/* Section: Tentang BedahGang */}
            <section className="mt-10 relative overflow-hidden bg-[#F2F8D9] p-5 text-[#364C84]">
              {/* dekor sederhana */}
              {/* <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rotate-12 rounded-2xl bg-[#E4F28F]" />
              <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 -rotate-6 rounded-2xl bg-[#D7E6A5]" /> */}

              <h2 className="relative z-10 text-[22px] leading-snug font-semibold">
                Walaupun kecil dan mudah dilewatkan,{" "}
                <span className="font-extrabold">sebuah gang menyimpan banyak cerita.</span>
              </h2>

              <div className="relative z-10 mt-4">
                <img
                  className="h-full w-full object-cover"
                  src="/landing-page/2.png"
                  alt="Deskripsi Gambar"
                />
              </div>

              <p className="relative z-10 mt-4 text-xs leading-relaxed">
                <span className="font-semibold">BedahGang</span> adalah inisiatif yang dimulai dari
                keinginan untuk menyorot kehidupan yang berada pada dan di antara gang. Hubungan
                yang dekat dan erat antar masyarakat tetap tumbuh beriringan dengan meningkatnya
                risiko akan bencana alam.
              </p>

              <p className="relative z-10 mt-3 text-xs font-semibold">
                Melalui riset dan desain, kami berupaya menjembatani komunitas menuju kampung
                yang lebih tangguh dalam menghadapi banjir.
              </p>

              <div className="relative z-10 mt-5 flex justify-center">
                <button
                  onClick={() => router.push("/about")}
                  className="w-full max-w-[260px] rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110 active:brightness-90"
                >
                  Kenali Bedah<span className="font-extrabold">Gang</span>
                </button>
              </div>
            </section>


        </div>



      {/* Permission */}
      {askOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end pb-20">
          <div className="absolute inset-0 -z-10 bg-black/40 backdrop-blur-sm" onClick={() => setAskOpen(false)} />

          <div className="mx-auto w-full max-w-[420px] px-4">
            <div className="mx-4 rounded-2xl bg-[#2F4F90] p-4 text-center text-white shadow-xl flex flex-col items-center">
              <div className="text-sm font-semibold">
                Izinkan <span className="font-extrabold">BedahGang</span> mengakses lokasi anda?
              </div>

              {errorMsg && (
                <div className="mt-2 text-xs text-rose-200">{errorMsg}</div>
              )}

              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  onClick={() => { setAskOpen(false); router.push("/input-gang?step=1"); }}
                  className="rounded-full bg-white/25 px-5 py-2 text-xs font-semibold text-white hover:bg-white/30"
                  disabled={requesting}
                >
                  Tidak
                </button>
                <button
                  onClick={requestLocation}
                  className="rounded-full bg-[#E4F28F] px-5 py-2 text-xs font-semibold text-[#2F4F90] hover:brightness-110 disabled:opacity-60"
                  disabled={requesting}
                >
                  {requesting ? "Meminta izin…" : "Ya"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

