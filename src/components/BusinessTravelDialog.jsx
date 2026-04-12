import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

// ─── Emission Factors ────────────────────────────────────────────────────────
const AIR_FACTORS = {
  "Economy - Short Haul (<3700km)": 0.255,
  "Economy - Long Haul (>3700km)": 0.195,
  "Premium Economy": 0.311,
  "Business Class": 0.429,
  "First Class": 0.597,
};
const ROAD_FACTORS = {
  "Car (Petrol)": 0.170, "Car (Diesel)": 0.168, "Car (EV)": 0.064,
  "Car (Hybrid)": 0.105, "Taxi / Rideshare": 0.182,
  "Bus": 0.089, "Coach": 0.027,
  "National Rail": 0.041, "Subway / Metro": 0.028,
  "Tram": 0.035,
};
const ACCOMM_STAR_FACTORS = {
  "Budget / 1-2 Star": 15, "3 Star": 22, "4 Star": 28,
  "5 Star / Luxury": 35, "All Hotels (Average)": 22,
};
// EEIO spend factors (kgCO2e / USD)
const EEIO_TRAVEL = {
  "Air Travel": 0.254, "Road / Rail": 0.190, "Accommodation": 0.150,
};

function QualityBadge({ score, label }) {
  const cfg = score >= 9 ? { color: "bg-amber-100 text-amber-700 border-amber-300" }
    : score >= 7 ? { color: "bg-slate-100 text-slate-600 border-slate-300" }
    : score >= 4 ? { color: "bg-orange-100 text-orange-700 border-orange-300" }
    : { color: "bg-red-50 text-red-600 border-red-200" };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>{label} · {score}/10</span>;
}

const TIER_CONFIG = {
  "Air Travel": [
    { key: "tier1", label: "Tier 1: Actual Fuel Use (Gold)", sub: "We have exact fuel allocation data from the airline for this flight.", score: 10 },
    { key: "tier2", label: "Tier 2: Distance-Based (Silver)", sub: "We know the origin/destination airports and cabin class. Industry standard.", score: 8 },
    { key: "tier3", label: "Tier 3: Spend-Based (Estimated)", sub: "We only know the ticket cost. Lowest quality, use as last resort.", score: 2 },
  ],
  "Road & Rail": [
    { key: "tier1", label: "Tier 1: Actual Fuel / Energy Use (Gold)", sub: "We have fuel receipts (litres) or kWh from EV charging for this trip.", score: 9 },
    { key: "tier2", label: "Tier 2: Distance-Based (Silver)", sub: "We know the distance traveled and vehicle/transport type.", score: 7 },
    { key: "tier3", label: "Tier 3: Spend-Based (Estimated)", sub: "We only know the fare or rental cost.", score: 2 },
  ],
  "Accommodation": [
    { key: "tier1", label: "Tier 1: Property-Specific Data (Gold)", sub: "The hotel provided an exact carbon footprint per room per night.", score: 10 },
    { key: "tier2", label: "Tier 2: CHSB Benchmark Data (Silver)", sub: "We know the hotel's star rating and country. Uses CHSB 2026 benchmarks.", score: 7 },
    { key: "tier3", label: "Tier 3: Spend-Based (Estimated)", sub: "We only know the hotel bill amount.", score: 2 },
  ],
};

export default function BusinessTravelDialog({ open, onClose, onSaved, subCategory = "Air Travel", defaultValues = {} }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier2");

  const [form, setForm] = useState({
    source_name: "", location_id: "", start_date: "", end_date: "",
    supplier: "", notes: "", status: "Draft",
    // Air Tier 1
    fuel_volume: "", fuel_type: "Jet A",
    // Air Tier 2
    cabin_class: "Economy - Short Haul (<3700km)", distance_km: "", rf_multiplier: true,
    // Air Tier 3
    ticket_spend: "", currency: "USD",
    // Road Tier 1
    road_fuel_volume: "", road_fuel_type: "Car (Petrol)",
    // Road Tier 2
    road_vehicle_type: "Car (Petrol)", road_distance_km: "",
    // Road Tier 3
    road_spend: "",
    // Accommodation Tier 1
    hotel_name: "", nights: "", rooms: "", property_ef: "",
    // Accommodation Tier 2
    star_rating: "3 Star", country: "",
    // Accommodation Tier 3
    hotel_spend: "",
    ...defaultValues,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);
  useEffect(() => { setTier("tier2"); }, [subCategory]);

  // ─── Calculations ────────────────────────────────────────────────────────
  let tco2e = 0, method = "", score = 2;

  if (subCategory === "Air Travel") {
    if (tier === "tier1") {
      const efMap = { "Jet A": 2.53, "SAF blend": 0.96 };
      tco2e = (parseFloat(form.fuel_volume) || 0) * (efMap[form.fuel_type] || 2.53) / 1000;
      score = 10; method = "Actual Fuel × Combustion Factor (DEFRA)";
    } else if (tier === "tier2") {
      const ef = AIR_FACTORS[form.cabin_class] || 0.255;
      const rf = form.rf_multiplier ? 1.891 : 1;
      tco2e = (parseFloat(form.distance_km) || 0) * ef * rf / 1000;
      score = 8; method = `Distance-Based · ${form.cabin_class} · DEFRA${form.rf_multiplier ? " + RF" : ""}`;
    } else {
      tco2e = (parseFloat(form.ticket_spend) || 0) * EEIO_TRAVEL["Air Travel"] / 1000;
      score = 2; method = "Spend-Based · EEIO";
    }
  } else if (subCategory === "Road & Rail") {
    if (tier === "tier1") {
      const fuelEf = { "Car (Petrol)": 2.31, "Car (Diesel)": 2.68, "Car (EV)": 0.79, "Car (Hybrid)": 1.55 };
      tco2e = (parseFloat(form.road_fuel_volume) || 0) * (fuelEf[form.road_fuel_type] || 2.31) / 1000;
      score = 9; method = "Actual Fuel × Combustion Factor";
    } else if (tier === "tier2") {
      const ef = ROAD_FACTORS[form.road_vehicle_type] || 0.170;
      tco2e = (parseFloat(form.road_distance_km) || 0) * ef / 1000;
      score = 7; method = `Distance-Based · ${form.road_vehicle_type} · DEFRA`;
    } else {
      tco2e = (parseFloat(form.road_spend) || 0) * EEIO_TRAVEL["Road / Rail"] / 1000;
      score = 2; method = "Spend-Based · EEIO";
    }
  } else if (subCategory === "Accommodation") {
    if (tier === "tier1") {
      tco2e = (parseFloat(form.nights) || 0) * (parseFloat(form.rooms) || 1) * (parseFloat(form.property_ef) || 0) / 1000;
      score = 10; method = "Property-Specific EF · CHSB 2026";
    } else if (tier === "tier2") {
      const ef = ACCOMM_STAR_FACTORS[form.star_rating] || 22;
      tco2e = (parseFloat(form.nights) || 0) * (parseFloat(form.rooms) || 1) * ef / 1000;
      score = 7; method = `CHSB 2026 Benchmark · ${form.star_rating}`;
    } else {
      tco2e = (parseFloat(form.hotel_spend) || 0) * EEIO_TRAVEL["Accommodation"] / 1000;
      score = 2; method = "Spend-Based · EEIO";
    }
  }

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    await base44.entities.EmissionEntry.create({
      scope: "Scope 3", category: "Business Travel",
      sub_category: subCategory,
      source_name: form.source_name || subCategory,
      location_id: form.location_id, location_name: loc?.name || "",
      supplier: form.supplier,
      start_date: form.start_date, end_date: form.end_date,
      tco2e: parseFloat(tco2e.toFixed(6)),
      calculation_method: method,
      data_quality_tier: `tier${tier.replace("tier", "")}`,
      data_quality_score: score,
      reporting_year: 2024,
      notes: form.notes,
      status: form.status,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  const hasInput = tco2e > 0;
  const tiers = TIER_CONFIG[subCategory] || TIER_CONFIG["Air Travel"];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Business Travel · {subCategory}</div>
            <h2 className="text-lg font-bold text-slate-900">Add {subCategory} Entry</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Common fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Description / Trip Name</Label>
              <Input className="mt-1" placeholder="e.g. Sydney → Melbourne" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Location</Label>
              <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Travel Date</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Traveller / Carrier</Label>
              <Input className="mt-1" placeholder="e.g. Qantas, John Smith" value={form.supplier} onChange={e => set("supplier", e.target.value)} />
            </div>
          </div>

          {/* Tier Selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-800 mb-3">Data Quality Tier — select the best available</div>
            <div className="space-y-2">
              {tiers.map(t => (
                <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                  <input type="radio" name="travel_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{t.label}</span>
                      <QualityBadge score={t.score} label={t.score >= 9 ? "Gold" : t.score >= 7 ? "Silver" : "Estimated"} />
                    </div>
                    <span className="text-xs text-slate-500">{t.sub}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── AIR TRAVEL ── */}
          {subCategory === "Air Travel" && tier === "tier1" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Fuel Volume (kg)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.fuel_volume} onChange={e => set("fuel_volume", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Fuel Type</Label>
                  <Select value={form.fuel_type} onValueChange={v => set("fuel_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Jet A">Jet A (2.53 kgCO₂e/kg)</SelectItem><SelectItem value="SAF blend">SAF Blend (0.96 kgCO₂e/kg)</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          {subCategory === "Air Travel" && tier === "tier2" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Cabin Class</Label>
                <Select value={form.cabin_class} onValueChange={v => set("cabin_class", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(AIR_FACTORS).map(k => <SelectItem key={k} value={k}>{k} ({AIR_FACTORS[k]} kgCO₂e/km)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Flight Distance (km)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.distance_km} onChange={e => set("distance_km", e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Use Great Circle distance between origin and destination airports.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.rf_multiplier} onChange={e => set("rf_multiplier", e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-xs text-slate-700">Apply Radiative Forcing (RF) multiplier ×1.891 — Recommended by DEFRA for full climate impact</span>
              </label>
            </div>
          )}
          {subCategory === "Air Travel" && tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Ticket Cost</Label>
                <Input type="number" className="mt-1" placeholder="0.00" value={form.ticket_spend} onChange={e => set("ticket_spend", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Currency</Label>
                <Select value={form.currency} onValueChange={v => set("currency", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD","AUD","EUR","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── ROAD & RAIL ── */}
          {subCategory === "Road & Rail" && tier === "tier1" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Fuel / Energy (L or kWh)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.road_fuel_volume} onChange={e => set("road_fuel_volume", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Fuel Type</Label>
                <Select value={form.road_fuel_type} onValueChange={v => set("road_fuel_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Car (Petrol)","Car (Diesel)","Car (EV)","Car (Hybrid)"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          {subCategory === "Road & Rail" && tier === "tier2" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Vehicle / Transport Type</Label>
                <Select value={form.road_vehicle_type} onValueChange={v => set("road_vehicle_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(ROAD_FACTORS).map(k => <SelectItem key={k} value={k}>{k} ({ROAD_FACTORS[k]} kgCO₂e/km)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Distance (km)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.road_distance_km} onChange={e => set("road_distance_km", e.target.value)} />
              </div>
            </div>
          )}
          {subCategory === "Road & Rail" && tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Total Fare / Rental Cost</Label>
                <Input type="number" className="mt-1" placeholder="0.00" value={form.road_spend} onChange={e => set("road_spend", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Currency</Label>
                <Select value={form.currency} onValueChange={v => set("currency", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD","AUD","EUR","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── ACCOMMODATION ── */}
          {subCategory === "Accommodation" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Number of Nights</Label>
                <Input type="number" className="mt-1" placeholder="1" value={form.nights} onChange={e => set("nights", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Number of Rooms</Label>
                <Input type="number" className="mt-1" placeholder="1" value={form.rooms} onChange={e => set("rooms", e.target.value)} />
              </div>
            </div>
          )}
          {subCategory === "Accommodation" && tier === "tier1" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Hotel Name</Label>
                <Input className="mt-1" placeholder="e.g. Hyatt Regency" value={form.hotel_name} onChange={e => set("hotel_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Property EF (kgCO₂e / room / night)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.property_ef} onChange={e => set("property_ef", e.target.value)} />
              </div>
            </div>
          )}
          {subCategory === "Accommodation" && tier === "tier2" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Star Rating / Segment</Label>
                <Select value={form.star_rating} onValueChange={v => set("star_rating", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(ACCOMM_STAR_FACTORS).map(k => <SelectItem key={k} value={k}>{k} ({ACCOMM_STAR_FACTORS[k]} kg/room/night)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Country</Label>
                <Input className="mt-1" placeholder="e.g. Australia" value={form.country} onChange={e => set("country", e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-slate-400">CHSB 2026 benchmarks used. If specific market area is unavailable, country average is applied.</p>
            </div>
          )}
          {subCategory === "Accommodation" && tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Hotel Bill Total</Label>
                <Input type="number" className="mt-1" placeholder="0.00" value={form.hotel_spend} onChange={e => set("hotel_spend", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Currency</Label>
                <Select value={form.currency} onValueChange={v => set("currency", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD","AUD","EUR","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input className="mt-1" placeholder="Additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Result Preview */}
          {hasInput && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Calculated Emissions</div>
                  <div className="text-2xl font-bold text-emerald-800">{tco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
                </div>
                <QualityBadge score={score} label={score >= 9 ? "Gold" : score >= 7 ? "Silver" : "Estimated"} />
              </div>
              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  <div><span className="font-semibold">Method:</span> {method}</div>
                  <div><span className="font-semibold">Category:</span> Scope 3, Category 6 — Business Travel</div>
                  <div><span className="font-semibold">Sub-category:</span> {subCategory}</div>
                  <div className="text-slate-400">References: DEFRA GHG Factors 2024 · ICAO Carbon Calculator · CHSB 2026 · GHG Protocol Cat 6</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !hasInput}>
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}