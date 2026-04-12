import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

// kgCO2e per litre combustion
const COMBUSTION_EF = { "Diesel": 2.68, "Petrol": 2.31, "Natural Gas": 2.04, "LPG": 1.51, "CNG": 2.04 };
const WTT_EF = { "Diesel": 0.618, "Petrol": 0.568, "Natural Gas": 0.473, "LPG": 0.330, "CNG": 0.473 };

const TIERS = [
  { key: "tier1", label: "Tier 1: Direct Fuel Log (Gold)", sub: "We have exact fuel volume pumped into the equipment from receipts/meters.", score: 9 },
  { key: "tier2", label: "Tier 2: Machine Hours + kW Rating (Silver)", sub: "We know operating hours and engine power rating. System estimates fuel use.", score: 7 },
];

function QualityBadge({ score }) {
  const cfg = score >= 9 ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-slate-100 text-slate-600 border-slate-300";
  const label = score >= 9 ? "Gold" : "Silver";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function EquipmentEmissionsDialog({ open, onClose, onSaved, equipment = null }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier1");
  const [form, setForm] = useState({
    source_name: "", location_id: "", start_date: "", end_date: "",
    fuel_type: "Diesel", notes: "", status: "Draft",
    exact_fuel_volume: "",
    machine_operating_hours: "", machine_power_rating_kw: "", load_factor_percentage: "75",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    base44.entities.Location.list().then(setLocations);
    if (equipment) {
      const fuelMap = { "Diesel": "Diesel", "Petrol": "Petrol", "Natural Gas": "Natural Gas", "LPG": "LPG", "CNG": "CNG" };
      setForm(f => ({
        ...f,
        source_name: equipment.equipment_name || "",
        location_id: equipment.location_id || "",
        fuel_type: fuelMap[equipment.power_source] || "Diesel",
        machine_power_rating_kw: equipment.machine_power_rating_kw ? String(equipment.machine_power_rating_kw) : "",
      }));
    }
  }, [open]);

  const fuelType = form.fuel_type;
  const combEF = COMBUSTION_EF[fuelType] ?? 2.68;
  const wttEF = WTT_EF[fuelType] ?? 0.618;

  let fuelLitres = 0;
  if (tier === "tier1") {
    fuelLitres = parseFloat(form.exact_fuel_volume) || 0;
  } else {
    const hours = parseFloat(form.machine_operating_hours) || 0;
    const kw = parseFloat(form.machine_power_rating_kw) || 0;
    const lf = (parseFloat(form.load_factor_percentage) || 75) / 100;
    // kWh = hours * kW * loadFactor; kWh to litres diesel: ~0.27 L/kWh
    const kwh = hours * kw * lf;
    fuelLitres = kwh * 0.27;
  }

  const scope1_tco2e = fuelLitres * combEF / 1000;
  const wtt_tco2e = fuelLitres * wttEF / 1000;
  const score = TIERS.find(t => t.key === tier)?.score || 7;

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const baseData = {
      source_name: form.source_name || equipment?.equipment_name || "Equipment Emissions",
      location_id: form.location_id,
      location_name: loc?.name || "",
      start_date: form.start_date,
      end_date: form.end_date,
      fuel_type: fuelType,
      equipment_id: equipment?.id,
      equipment_type: equipment?.equipment_type,
      data_quality_tier: tier,
      data_quality_score: score,
      reporting_year: 2024,
      notes: form.notes,
      status: form.status,
    };

    await base44.entities.EmissionEntry.create({
      ...baseData,
      scope: "Scope 1",
      category: "Stationary Combustion",
      sub_category: "Equipment / Machinery",
      exact_fuel_volume: fuelLitres > 0 ? parseFloat(fuelLitres.toFixed(4)) : undefined,
      machine_operating_hours: parseFloat(form.machine_operating_hours) || undefined,
      machine_power_rating_kw: parseFloat(form.machine_power_rating_kw) || undefined,
      load_factor_percentage: parseFloat(form.load_factor_percentage) || undefined,
      tco2e: parseFloat(scope1_tco2e.toFixed(6)),
      calculation_method: tier === "tier1" ? `Exact fuel × combustion EF (${combEF} kgCO₂e/L)` : `Machine hours × kW × load factor → fuel → combustion EF`,
    });

    if (wtt_tco2e > 0) {
      await base44.entities.EmissionEntry.create({
        ...baseData,
        scope: "Scope 3",
        category: "Fuel and Energy-Related Activities",
        sub_category: "WTT — Equipment Fuels",
        s3_category_number: 3,
        tco2e: parseFloat(wtt_tco2e.toFixed(6)),
        wtt_tco2e: parseFloat(wtt_tco2e.toFixed(6)),
        calculation_method: `WTT auto-record: Fuel × WTT EF (${wttEF} kgCO₂e/L)`,
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
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 1 · Stationary Combustion</div>
            <h2 className="text-lg font-bold text-slate-900">Log Equipment Emissions</h2>
            {equipment && <p className="text-xs text-slate-500 mt-0.5">{equipment.equipment_name} · {equipment.equipment_type}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800">
            <span className="font-semibold">Auto-generates:</span> Scope 1 (combustion) + Scope 3 Cat 3 WTT upstream record.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Equipment / Description</Label>
              <Input className="mt-1" placeholder="e.g. Diesel Generator A" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
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

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-blue-800 mb-2">Data Quality Tier</div>
            {TIERS.map(t => (
              <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                <input type="radio" name="eq_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Operating Hours</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.machine_operating_hours} onChange={e => set("machine_operating_hours", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Power Rating (kW)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.machine_power_rating_kw} onChange={e => set("machine_power_rating_kw", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Load Factor (%)</Label>
                <Input type="number" className="mt-1" placeholder="75" min="0" max="100" value={form.load_factor_percentage} onChange={e => set("load_factor_percentage", e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Typical load factor: 50–80%. Estimated fuel = Hours × kW × Load Factor × 0.27 L/kWh.</p>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input className="mt-1" placeholder="Fuel log ref, equipment maintenance period..." value={form.notes} onChange={e => set("notes", e.target.value)} />
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
                  <div className="text-slate-400">References: DEFRA GHG Factors 2024 · NGER Measurement Determination · GHG Protocol Scope 1</div>
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