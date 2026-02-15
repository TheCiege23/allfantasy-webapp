"use client";

import { useEffect, useState, memo } from "react";
import { MapPin, Globe, RefreshCw, Users } from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from "react-simple-maps";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface VisitorLocation {
  id: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  visits: number;
  lastSeen: string;
}

interface CountryData {
  country: string;
  countryCode?: string;
  visits: number;
}

const countryCodeMap: Record<string, string> = {
  "USA": "840", "US": "840",
  "CAN": "124", "CA": "124",
  "GBR": "826", "GB": "826", "UK": "826",
  "DEU": "276", "DE": "276",
  "FRA": "250", "FR": "250",
  "AUS": "036", "AU": "036",
  "JPN": "392", "JP": "392",
  "CHN": "156", "CN": "156",
  "IND": "356", "IN": "356",
  "BRA": "076", "BR": "076",
  "MEX": "484", "MX": "484",
  "RUS": "643", "RU": "643",
  "ZAF": "710", "ZA": "710",
  "NGA": "566", "NG": "566",
  "EGY": "818", "EG": "818",
  "DZA": "012", "DZ": "012",
  "SDN": "729", "SD": "729",
  "KEN": "404", "KE": "404",
  "TUR": "792", "TR": "792",
  "SAU": "682", "SA": "682",
  "ARE": "784", "AE": "784",
  "IRN": "364", "IR": "364",
  "IRQ": "368", "IQ": "368",
  "ESP": "724", "ES": "724",
  "ITA": "380", "IT": "380",
  "NLD": "528", "NL": "528",
  "BEL": "056", "BE": "056",
  "CHE": "756", "CH": "756",
  "AUT": "040", "AT": "040",
  "POL": "616", "PL": "616",
  "SWE": "752", "SE": "752",
  "NOR": "578", "NO": "578",
  "DNK": "208", "DK": "208",
  "FIN": "246", "FI": "246",
  "PRT": "620", "PT": "620",
  "GRC": "300", "GR": "300",
  "IRL": "372", "IE": "372",
  "NZL": "554", "NZ": "554",
  "ARG": "032", "AR": "032",
  "CHL": "152", "CL": "152",
  "COL": "170", "CO": "170",
  "PER": "604", "PE": "604",
  "VEN": "862", "VE": "862",
  "PHL": "608", "PH": "608",
  "IDN": "360", "ID": "360",
  "MYS": "458", "MY": "458",
  "SGP": "702", "SG": "702",
  "THA": "764", "TH": "764",
  "VNM": "704", "VN": "704",
  "KOR": "410", "KR": "410",
  "TWN": "158", "TW": "158",
  "HKG": "344", "HK": "344",
  "PAK": "586", "PK": "586",
  "BGD": "050", "BD": "050",
  "UKR": "804", "UA": "804",
  "ROU": "642", "RO": "642",
  "CZE": "203", "CZ": "203",
  "HUN": "348", "HU": "348",
  "ISR": "376", "IL": "376",
};

const MapChart = memo(function MapChart({ 
  visitedCountryCodes, 
  locations, 
  hoveredLocation, 
  setHoveredLocation 
}: { 
  visitedCountryCodes: Set<string>;
  locations: VisitorLocation[];
  hoveredLocation: VisitorLocation | null;
  setHoveredLocation: (loc: VisitorLocation | null) => void;
}) {
  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{
        scale: 130,
        center: [0, 30]
      }}
      style={{ width: "100%", height: "auto", backgroundColor: "#0d1117" }}
    >
      <ZoomableGroup center={[0, 20]} zoom={1}>
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: Array<{ rsmKey: string; id: string; properties: Record<string, unknown> }> }) =>
            geographies.map((geo: { rsmKey: string; id: string; properties: Record<string, unknown> }) => {
              const numericCode = geo.id;
              const isVisited = visitedCountryCodes.has(numericCode);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isVisited ? "#3b82f6" : "#1f2937"}
                  stroke="#374151"
                  strokeWidth={0.3}
                  style={{
                    default: { outline: "none" },
                    hover: { 
                      fill: isVisited ? "#60a5fa" : "#374151", 
                      outline: "none" 
                    },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>

        {locations.map((loc) => {
          if (!loc.lat || !loc.lng) return null;
          const size = Math.min(8, 3 + Math.log2(loc.visits + 1) * 1.5);
          const isHovered = hoveredLocation?.id === loc.id;

          return (
            <Marker 
              key={loc.id} 
              coordinates={[loc.lng, loc.lat]}
              onMouseEnter={() => setHoveredLocation(loc)}
              onMouseLeave={() => setHoveredLocation(null)}
            >
              <circle
                r={size * 2}
                fill="rgb(34, 211, 238)"
                opacity={0.2}
                className="animate-pulse"
              />
              <circle
                r={size}
                fill="rgb(34, 211, 238)"
                opacity={isHovered ? 1 : 0.8}
                stroke="#fff"
                strokeWidth={0.5}
                style={{ 
                  cursor: "pointer",
                  filter: isHovered ? "brightness(1.3) drop-shadow(0 0 6px rgb(34, 211, 238))" : undefined 
                }}
              />
              <circle r={size * 0.35} fill="white" opacity={0.9} />
            </Marker>
          );
        })}
      </ZoomableGroup>
    </ComposableMap>
  );
});

export default function VisitorMap() {
  const [locations, setLocations] = useState<VisitorLocation[]>([]);
  const [byCountry, setByCountry] = useState<CountryData[]>([]);
  const [totalUnique, setTotalUnique] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hoveredLocation, setHoveredLocation] = useState<VisitorLocation | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/visitor-locations");
      const data = await res.json();
      if (data.ok) {
        setLocations(data.locations || []);
        setByCountry(data.byCountry || []);
        setTotalUnique(data.totalUnique || 0);
        setTotalVisits(data.totalVisits || 0);
      }
    } catch (e) {
      console.error("Failed to load visitor locations:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visitedCountryCodes = new Set<string>();
  byCountry.forEach((c) => {
    if (c.countryCode) {
      const numericCode = countryCodeMap[c.countryCode.toUpperCase()];
      if (numericCode) visitedCountryCodes.add(numericCode);
    }
  });
  locations.forEach((loc) => {
    if (loc.countryCode) {
      const numericCode = countryCodeMap[loc.countryCode.toUpperCase()];
      if (numericCode) visitedCountryCodes.add(numericCode);
    }
  });

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Visitor Map</h3>
              <p className="text-xs text-white/50">Unique IP locations</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-cyan-400" />
                <span className="text-white/70">{totalUnique} unique</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-400" />
                <span className="text-white/70">{totalVisits} visits</span>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative" style={{ minHeight: 300 }}>
        <MapChart
          visitedCountryCodes={visitedCountryCodes}
          locations={locations}
          hoveredLocation={hoveredLocation}
          setHoveredLocation={setHoveredLocation}
        />

        {hoveredLocation && (
          <div className="absolute top-4 left-4 bg-black/90 backdrop-blur-sm rounded-xl border border-white/10 p-3 text-sm z-10">
            <div className="font-medium">
              {hoveredLocation.city || "Unknown"}, {hoveredLocation.country || "Unknown"}
            </div>
            <div className="text-xs text-white/50 mt-1">
              {hoveredLocation.visits} visit{hoveredLocation.visits !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {locations.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center p-6">
              <Globe className="h-12 w-12 mx-auto text-white/20 mb-3" />
              <p className="text-white/50 text-sm">No visitor locations tracked yet</p>
              <p className="text-white/30 text-xs mt-1">Locations appear as visitors browse the site</p>
            </div>
          </div>
        )}

        {loading && locations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        )}
      </div>

      {byCountry.length > 0 && (
        <div className="p-4 sm:p-6 border-t border-white/5">
          <h4 className="text-sm font-medium text-white/70 mb-3">Top Countries</h4>
          <div className="flex flex-wrap gap-2">
            {byCountry.slice(0, 10).map((c) => (
              <div
                key={c.country}
                className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs"
              >
                <span className="font-medium">{c.country}</span>
                <span className="text-white/50">{c.visits}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
