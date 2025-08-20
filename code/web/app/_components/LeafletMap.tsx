"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Geo = { lat: number; lng: number; accuracy?: number };

export default function LeafletMap({
  center,
  user,
  zoomWhenUser = 16,
}: {
  center: { lat: number; lng: number };
  user: Geo | null;
  zoomWhenUser?: number;
}) {
  // Hindari hydration mismatch: tunggu sampai mounted di client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="h-full w-full">
      <MapContainer
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {user && (
          <>
            <Recenter lat={user.lat} lng={user.lng} zoom={zoomWhenUser} />
            <CircleMarker
              center={[user.lat, user.lng]}
              pathOptions={{ color: "#3A54A0", weight: 2, fillOpacity: 0.9 }}
            />
            <Popup position={[user.lat, user.lng]}>
              Anda di sini
              <br />
              {user.lat.toFixed(5)}, {user.lng.toFixed(5)}
            </Popup>
          </>
        )}
      </MapContainer>
    </div>
  );
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}
