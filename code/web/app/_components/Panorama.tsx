"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  src: string;                 // path di /public
  fov?: number;                // FOV awal
  className?: string;          // wajib punya height (mis. h-[560px])
  autorotate?: boolean;        // auto muter pelan
  autorotateSpeed?: number;    // rad/s kecil, default 0.15
};

export default function Panorama({
  src,
  fov = 75,
  className = "w-full h-[560px] rounded-2xl overflow-hidden shadow",
  autorotate = false,
  autorotateSpeed = 0.15,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    // Scene & Camera (di dalam sphere)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      fov,
      el.clientWidth / el.clientHeight,
      0.1,
      1100
    );
    camera.position.set(0, 0, 0);
    camera.rotation.order = "YXZ"; // supaya yaw-pitch gampang

    // Sphere dibalik (lihat dari dalam)
    const geometry = new THREE.SphereGeometry(500, 64, 48);
    geometry.scale(-1, 1, 1);

    const texture = new THREE.TextureLoader().load(src);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // State kontrol drag
    let isDown = false;
    let startX = 0;
    let startY = 0;
    let yaw = 0;    // rotasi horizontal
    let pitch = 0;  // rotasi vertikal
    const pitchLimit = Math.PI / 2 - 0.01; // cegah terbalik

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      startX = e.clientX;
      startY = e.clientY;
      el.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      // skala sensitivitas (semakin kecil semakin halus)
      const sens = 0.0025;
      yaw   -= dx * sens;                 // drag kiri-kanan
      pitch -= dy * sens;                 // drag atas-bawah
      pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
    };
    const onPointerUp = () => {
      isDown = false;
      el.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      // Zoom dengan mengubah FOV
      camera.fov = THREE.MathUtils.clamp(camera.fov + (e.deltaY > 0 ? 2 : -2), 30, 100);
      camera.updateProjectionMatrix();
    };

    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: true });

    // Resize
    const onResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Loop
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      if (autorotate) {
        // putar sphere pelan untuk efek autorotate
        sphere.rotation.y += autorotateSpeed * 0.016; // ~60fps
      }

      // Terapkan yaw/pitch ke kamera
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("wheel", onWheel);
      el.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [src, fov, autorotate, autorotateSpeed]);

  return <div ref={containerRef} className={className} />;
}
