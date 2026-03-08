import React, { useMemo, useState } from "react";
import { GoogleMap, useLoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import locationsRaw from "./locations.json";
import type { Place } from "./types";


// Haversine distance in meters
function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export default function App() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
  });

  const locations = locationsRaw as Place[];

  // Center map on first location if available
  const center = {
    lat: locations[0]?.coordinates[0] ?? 38.5611,
    lng: locations[0]?.coordinates[1] ?? -121.4240,
  };

  // Which place is clicked
  const [selected, setSelected] = useState<Place | null>(null);

  // user location
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Fullscreen photo 
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  // mobile nearest toggle
  const [nearestOpen, setNearestOpen] = useState(false);

  // filter state
  const [filter, setFilter] = useState<"all" | "vending" | "microwave">("all");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // filtered locations
  const filteredLocations =
    filter === "all"
      ? locations
      : locations.filter((loc) => loc.type.includes(filter));

  function directionsUrl(place: Place) {
    const [destLat, destLng] = place.coordinates;

    // if we have user's location, use it as origin
    if (userCoords) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${destLat},${destLng}&travelmode=walking`;
    }

    // otherwise, just open destination
    return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=walking`;
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);

        // pan to user when found
        map?.panTo(coords);
        map?.setZoom(17);

        // on mobile, keep nearest collapsed until they want it
        setNearestOpen(false);
      },
      () => alert("Couldn't get your location. Check permissions."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  //nearest list computed from filteredLocations (top 5)
  const nearestList = useMemo(() => {
    if (!userCoords) return [];

    const list = filteredLocations.map((loc) => {
      const dest = { lat: loc.coordinates[0], lng: loc.coordinates[1] };
      const meters = distanceMeters(userCoords, dest);
      return { loc, meters };
    });

    list.sort((a, b) => a.meters - b.meters);
    return list.slice(0, 5);
  }, [userCoords, filteredLocations]);

  //if filter changes and selected no longer matches, close it
  React.useEffect(() => {
    if (!selected) return;
    const stillVisible =
      filter === "all" || selected.type.includes(filter);

    if (!stillVisible) setSelected(null);
  }, [filter, selected]);

  if (loadError) return <div>Map failed to load</div>;
  if (!isLoaded) return <div>Loading map...</div>;

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <GoogleMap
        mapContainerStyle={{ height: "100%", width: "100%" }}
        zoom={16}
        center={center}
        onLoad={(m) => setMap(m)}
      >
        {/* markers use filteredLocations */}
        {filteredLocations.map((loc) => (
          <Marker
            key={loc.id}
            position={{ lat: loc.coordinates[0], lng: loc.coordinates[1] }}
            onClick={() => setSelected(loc)}
          />
        ))}

        {/* user marker */}
        {userCoords && <Marker position={userCoords} />}

        {/* InfoWindow for selected */}
        {selected && (
          <InfoWindow
            position={{ lat: selected.coordinates[0], lng: selected.coordinates[1] }}
            onCloseClick={() => setSelected(null)}
          >
            <div style={{ maxWidth: 240, color: "black" }}>
              <strong style={{ display: "block", marginBottom: 6 }}>
                {selected.place}
              </strong>

              {/* Multiple photos + clickable */}
              {selected.photos && selected.photos.length > 0 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 8 }}>
                  {selected.photos.map((p, idx) => (
                    <img
                      key={idx}
                      src={p}
                      alt={`${selected.place} ${idx + 1}`}
                      onClick={() => setActivePhoto(p)}
                      style={{
                        width: 120,
                        height: 80,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              )}

              {selected.description && (
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  {selected.description}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href={directionsUrl(selected)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13 }}
                >
                  Directions
                </a>
                <button onClick={() => setSelected(null)} style={{ fontSize: 13 }}>
                  Close
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* top-left controls */}
      <div style={{ position: "absolute", top: 50, left: 12, zIndex: 3000 }}>
        <button
          onClick={requestLocation}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
            color: "black",
            width: 180,
          }}
        >
          Use my location
        </button>

        {/* filter buttons */}
        <div
          style={{
            position: "absolute",
            top:32.5,
            marginTop: 10,
            display: "flex",
            gap: 6,
            background: "white",
            padding: 8,
            borderRadius: 12,
            border: "1px solid #eee",
          }}
        >
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: filter === "all" ? "#111" : "white",
              color: filter === "all" ? "white" : "black",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            All
          </button>

          <button
            onClick={() => setFilter("vending")}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: filter === "vending" ? "#111" : "white",
              color: filter === "vending" ? "white" : "black",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Vending
          </button>

          <button
            onClick={() => setFilter("microwave")}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: filter === "microwave" ? "#111" : "white",
              color: filter === "microwave" ? "white" : "black",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Microwave
          </button>
        </div>
      </div>

      {/* nearest list (responsive) */}
      {userCoords && (
        <>
          {isMobile ? (
            // mobile bottom sheet
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 3500 }}>
              <button
                onClick={() => setNearestOpen((v) => !v)}
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                  color: "black",
                }}
              >
                Nearest ({filter}) {nearestOpen ? "▲" : "▼"}
              </button>

              {nearestOpen && (
                <div
                  style={{
                    marginTop: 8,
                    background: "white",
                    color: "black",
                    padding: 10,
                    borderRadius: 12,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                    maxHeight: 220,
                    overflowY: "auto",
                  }}
                >
                  {nearestList.length === 0 ? (
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      No locations match this filter.
                    </div>
                  ) : (
                    nearestList.map(({ loc, meters }) => (
                      <button
                        key={loc.id}
                        onClick={() => {
                          setSelected(loc);
                          setNearestOpen(false);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 10px",
                          borderRadius: 10,
                          color: "black",
                          border: "1px solid #eee",
                          background: "white",
                          cursor: "pointer",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{loc.place}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          {(meters / 1609.34).toFixed(2)} mi
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            // desktop left panel
            <div
              style={{
                position: "absolute",
                top: 160,
                left: 12,
                zIndex: 3000,
                background: "white",
                color: "black",
                padding: 10,
                borderRadius: 12,
                width: 260,
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Nearest ({filter})
              </div>

              {nearestList.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  No locations match this filter.
                </div>
              ) : (
                nearestList.map(({ loc, meters }) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelected(loc)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 10,
                      color: "black",
                      border: "1px solid #eee",
                      background: "white",
                      cursor: "pointer",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{loc.place}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {(meters / 1609.34).toFixed(2)} mi
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* bottom info card (desktop only) */}
      {selected && !isMobile && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            zIndex: 4000,
            background: "white",
            color: "black",
            padding: 12,
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          {selected.photos && selected.photos.length > 0 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10 }}>
              {selected.photos.map((p, idx) => (
                <img
                  key={idx}
                  src={p}
                  alt={`${selected.place} ${idx + 1}`}
                  onClick={() => setActivePhoto(p)}
                  style={{
                    width: 120,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 8,
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ fontWeight: 800 }}>{selected.place}</div>

          {selected.description && (
            <div style={{ fontSize: 13, marginTop: 6 }}>{selected.description}</div>
          )}

          <div style={{ marginTop: 10 }}>
            <a
              href={directionsUrl(selected)}
              target="_blank"
              rel="noreferrer"
              style={{ marginRight: 12 }}
            >
              Directions
            </a>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Fullscreen photo overlay */}
      {activePhoto && (
        <div
          onClick={() => setActivePhoto(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "pointer",
          }}
        >
          <img
            src={activePhoto}
            alt="Full view"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: 12,
            }}
          />
        </div>
      )}
    </div>
  );
}