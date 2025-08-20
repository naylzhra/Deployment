// app/about/page.tsx
"use client";

import Image from "next/image";
import AboutImage from "../../public/about.png";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="w-full">
        <Image
          src={AboutImage}
          alt="About BedahGang"
          className="w-full h-auto"
          priority
        />
      </div>
    </main>
  );
}
