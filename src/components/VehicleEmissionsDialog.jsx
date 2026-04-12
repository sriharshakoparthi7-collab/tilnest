import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

// kgCO2e per litre combustion
const COMBUSTION_EF = { "Petrol": 2.31, "Diesel": 2.68, "CNG": 2.04, "LPG": 1.51, "Hybrid": 2.00, "Electric": 0.0 };
// kgCO2e per litre WTT (Well-to-Tank upstream)
const WTT_EF = { "Petrol": 0.568, "Diesel": 0.618, "CNG": 0.473, "LPG": 0.330, "Hybrid": 0.450, "Electric": 0.0 };
// Default L/100km efficiency by vehicle class
const EFFICIENCY = {
  "Passenger Car (Small)": 7.5, "Passenger Car (Medium)": 9.2, "Passenger Car (Large/SUV)": 11.8,
  "Van": 11.5, "Light Commercial": 12.0, "Heavy Goods Vehicle (Truck)": 28.0,
  "Bus": 35.0, "Motorcycle": 4.5,
};

const TIERS = [
  { key: "tier1", label: "Tier 1: Exact Fuel Log (Gold)", sub: "We have exact litres/gallons from fleet fuel cards or receipts.", score: 9 },
  { key: "tier2", label: "Tier 2: Distance Driven (Silver)", sub: "We know odometer/distance and vehicle class. System estimates fuel use.", score: 7 },
  { key: "tier3", label: "Tier 3: Fuel Spend (Estimated)", sub: "We only have total fuel card spend.", score: 2 },
];

function QualityBadge({ score }) {
  const cfg = score >= 9 ? "bg-amber-100 text-amber-700 border-amber-300" : score >= 7 ? "bg-slate-100 text-slate-600 border-slate-300" : "bg-red-50 text-red-600 border-red-200";
  const label = score >= 9 ? "Gold" : score >= 7 ? "Silver" : "Estimated";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function VehicleEmissionsDialog({ open, onClose, onSaved, vehicle = null }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier1");
  const [form, setForm] = useState({
    source_name: "", location_id: "", start_date: "", end_date: "",
    fuel_type: "Diesel", notes: "", status: "Draft",
    exact_fuel_volume: "",
    vehicle_class: "Passenger Car (Medium)", distance_km: "",
    fuel_spend: "", currency: "AUD",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    base44.entities.Location.list().then(setLocations);
    if (vehicle) {
      setForm(f => ({
        ...f,
        source_name: vehicle.name || "",
        location_id: vehicle.location_id || "",
        fuel_type: vehicle.fuel_type || "Diesel",
      }));
    }
  }, [open]);

  const fuelType = form.fuel_type;
  const combEF = COMBUSTION_EF[fuelType] ?? 2.31;
  const wttEF = WTT_EF[fuelType] ?? 0.568;

  let fuelLitres = 0;
  if (tier === "tier1") fuelLitres = parseFloat(form.exact_fuel_volume) || 0;
  else if (tier === "tier2") {
    const eff = EFFICIENCY[form.vehicle_class] || 9.2;
    fuelLitres = (parseFloat(form.distance_km) || 0) * eff / 100;
  } else {
    fuelLitres = (parseFloat(form.fuel_spend) || 0) / 1.80; // rough AUD/L estimate
  }

  const scope1_tco2e = fuelLitres * combEF / 1000;
  const wtt_tco2e = fuelLitres * wttEF / 1000;
  const score = TIERS.find(t => t.key === tier)?.score || 7;

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const baseData = {
      source_name: form.source_name || vehicle?.name || "Vehicle Emissions",
      location_id: form.location_id,
      location_name: loc?.name || "",
      start_date: form.start_date,
      end_date: form.end_date,
      fuel_type: fuelType,
      vehicle_id: vehicle?.id,
      vehicle_class: form.vehicle_class,
      data_quality_tier: tier,
      data_quality_score: score,
      reporting_year: 2024,
      notes: form.notes,
      status: form.status,
    };

    // Scope 1 record
    await base44.entities.EmissionEntry.create({
      ...baseData,
      scope: "Scope 1",
      category: "Mobile Combustion",
      sub_category: "Company Vehicles",
      exact_fuel_volume: fuelLitres > 0 ? parseFloat(fuelLitres.toFixed(4)) : undefined,
      tco2e: parseFloat(scope1_tco2e.toFixed(6)),
      calculation_method: tier === "tier1" ? `Exact fuel × combustion EF (${combEF} kgCO₂e/L)` : tier === "tier2" ? `Distance × efficiency × combustion EF` : "Spend-based estimate",
    });

    // Scope 3 Cat 3 WTT record (auto-generated)
    if (wtt_tco2e > 0) {
      await base44.entities.EmissionEntry.create({
        ...baseData,
        scope: "Scope 3",
        category: "Fuel and Energy-Related Activities",
        sub_category: "WTT — Vehicle Fuels",
        s3_category_number: 3,
        tco2e: parseFloat(wtt_tco2e.toFixed(6)),
        wtt_tco2e: parseFloat(wtt_tco2e.toFixed(6)),
        calculation_method: `WTT: Fuel × WTT EF (${wttEF} kgCO₂e/L) — auto-generated from Scope 1`,
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;
  const hasInput = scope1_tco2e > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 1 · Mobile Combustion</div>
            <h2 className="text-lg font-bold text-slate-900">Log Vehicle Emissions</h2>
            {vehicle && <p className="text-xs text-slate-500 mt-0.5">{vehicle.name} · {vehicle.fuel_type}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800">
            <span className="font-semibold">Auto-generates:</span> Scope 1 (combustion) + Scope 3 Cat 3 WTT upstream record.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Vehicle / Description</Label>
              <Input className="mt-1" placeholder="e.g. Sales Car 1" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
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
              <Label className="text-sm font-medium">Period Start</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Period End</Label>
              <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Fuel Type</Label>
            <Select value={form.fuel_type} onValueChange={v => set("fuel_type", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(COMBUSTION_EF).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Tier selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-blue-800 mb-2">Data Quality Tier</div>
            {TIERS.map(t => (
              <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                <input type="radio" name="veh_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{t.label}</span>
                    <QualityBadge score={t.score} />
                  </div>
                  <span className="text-xs text-slate-500">{t.sub}</span>
                </div>
              </label>
            ))}
          </div>

          {tier === "tier1" && (
            <div>
              <Label className="text-sm font-medium">Exact Fuel Volume (Litres)</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.exact_fuel_volume} onChange={e => set("exact_fuel_volume", e.target.value)} />
            </div>
          )}
          {tier === "tier2" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Vehicle Class</Label>
                <Select value={form.vehicle_class} onValueChange={v => set("vehicle_class", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(EFFICIENCY).map(c => <SelectItem key={c} value={c}>{c} ({EFFICIENCY[c]}L/100km)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Distance (km)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.distance_km} onChange={e => set("distance_km", e.target.value)} />
              </div>
            </div>
          )}
          {tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Fuel Card Spend</Label>
                <Input type="number" className="mt-1" placeholder="0.00" value={form.fuel_spend} onChange={e => set("fuel_spend", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Currency</Label>
                <Select value={form.currency} onValueChange={v => set("currency", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["AUD","USD","EUR","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input className="mt-1" placeholder="Fuel card ref, route..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {hasInput && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Scope 1 Emissions</div>
                  <div className="text-2xl font-bold text-emerald-800">{scope1_tco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
                </div>
                <QualityBadge score={score} />
              </div>
              <div className="text-xs text-slate-600">
                + Scope 3.3 WTT auto-record: <span className="font-semibold">{wtt_tco2e.toFixed(4)} tCO₂e</span>
              </div>
              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  <div><span className="font-semibold">Fuel used:</span> {fuelLitres.toFixed(2)} L ({fuelType})</div>
                  <div><span className="font-semibold">Combustion EF:</span> {combEF} kgCO₂e/L</div>
                  <div><span className="font-semibold">WTT EF:</span> {wttEF} kgCO₂e/L</div>
                  <div className="text-slate-400">References: DEFRA GHG Factors 2024 · Australian NGA 2024 · GHG Protocol Scope 1</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !hasInput}>
            {saving ? "Saving..." : "Log Emissions"}
          </Button>
        </div>
      </div>
    </div>
  );
}