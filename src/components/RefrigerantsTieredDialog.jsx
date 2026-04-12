import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const REFRIGERANT_GWP = {
  "R-22 (HCFC)": 1810, "R-32": 675, "R-134a": 1430,
  "R-407C": 1774, "R-410A": 2088, "R-404A": 3922,
  "R-507A": 3985, "CO₂ (R-744)": 1, "Ammonia (R-717)": 0,
  "SF6 (Industrial)": 23500, "HFO-1234yf": 1,
  "Methane (CH4)": 28, "Nitrous Oxide (N2O)": 265,
};

// Default annual leak rates by equipment category (%)
const LEAK_RATES = {
  "Domestic Fridge / Freezer": 0.5,
  "Commercial Refrigeration (Small)": 5,
  "Commercial Refrigeration (Large)": 15,
  "Commercial AC (Split System)": 3,
  "Commercial AC (Chiller)": 10,
  "Industrial Process Cooling": 12,
  "Transport Refrigeration": 20,
  "Industrial Gas System (SF6)": 0.5,
};

const SOURCE_TYPES = ["HVAC / Refrigeration", "Industrial Gas Leaks (e.g., SF6, Methane)"];

function QualityBadge({ label, score }) {
  const cfg = score >= 9 ? "bg-amber-100 text-amber-700 border-amber-300"
    : score >= 7 ? "bg-slate-100 text-slate-600 border-slate-300"
    : "bg-orange-100 text-orange-700 border-orange-300";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function RefrigerantsTieredDialog({ open, onClose, onSaved, defaultValues = {} }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier1");

  const [form, setForm] = useState({
    source_name: "", location_id: "", start_date: "", end_date: "",
    notes: "", status: "Draft",
    source_type: "HVAC / Refrigeration",
    refrigerant_gas: "R-410A",
    // Tier 1
    amount_added_kg: "",
    // Tier 2
    equipment_capacity_kg: "", equipment_category: "Commercial AC (Split System)",
    ...defaultValues,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const gwp = REFRIGERANT_GWP[form.refrigerant_gas] || 2088;

  let tco2e = 0, method = "", score = 9;
  if (tier === "tier1") {
    tco2e = (parseFloat(form.amount_added_kg) || 0) * gwp / 1000;
    score = 9; method = `Exact Top-Up × GWP (${gwp}) — IPCC AR6`;
  } else {
    const leakRate = LEAK_RATES[form.equipment_category] || 5;
    tco2e = (parseFloat(form.equipment_capacity_kg) || 0) * (leakRate / 100) * gwp / 1000;
    score = 6; method = `Capacity (${form.equipment_capacity_kg || 0} kg) × Leak Rate (${leakRate}%) × GWP (${gwp})`;
  }

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    await base44.entities.EmissionEntry.create({
      scope: "Scope 1", category: "Refrigerants",
      sub_category: form.source_type,
      source_name: form.source_name,
      location_id: form.location_id, location_name: loc?.name || "",
      start_date: form.start_date, end_date: form.end_date,
      quantity: tier === "tier1" ? parseFloat(form.amount_added_kg) || undefined : parseFloat(form.equipment_capacity_kg) || undefined,
      unit: "kg",
      tco2e: parseFloat(tco2e.toFixed(6)),
      calculation_method: method,
      data_quality_tier: tier,
      data_quality_score: score,
      reporting_year: 2024,
      notes: form.notes, status: form.status,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 1 · Fugitive Emissions</div>
            <h2 className="text-lg font-bold text-slate-900">Add Refrigerant / Fugitive Emission</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Scope 1 notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800">
            <span className="font-semibold">⚠️ Scope 1 Only:</span> Fugitive emissions are classified strictly as Scope 1. No Scope 3 Category 3 linkage is triggered for this module.
          </div>

          {/* Source type */}
          <div>
            <Label className="text-sm font-medium">Emission Source Type</Label>
            <Select value={form.source_type} onValueChange={v => set("source_type", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Common */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Equipment / Asset Name</Label>
              <Input className="mt-1" placeholder="e.g. Server Room Chiller" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
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
              <Label className="text-sm font-medium">Service Date</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">End Date</Label>
              <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>

          {/* Refrigerant type */}
          <div>
            <Label className="text-sm font-medium">Refrigerant / Gas Type</Label>
            <Select value={form.refrigerant_gas} onValueChange={v => set("refrigerant_gas", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(REFRIGERANT_GWP).map(([k, v]) => <SelectItem key={k} value={k}>{k} — GWP: {v}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Tier selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-blue-800 mb-2">Data Quality Tier</div>
            {[
              { key: "tier1", label: "Tier 1: Exact Maintenance Logs (Gold)", sub: "We know exactly how much gas was added to top up the system during servicing.", score: 9 },
              { key: "tier2", label: "Tier 2: Capacity Estimate (Silver)", sub: "We only know the total charge capacity of the equipment. System estimates leakage using industry default leak rates.", score: 6 },
            ].map(t => (
              <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                <input type="radio" name="refrig_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{t.label}</span>
                    <QualityBadge score={t.score} label={t.score >= 9 ? "Gold" : "Silver"} />
                  </div>
                  <span className="text-xs text-slate-500">{t.sub}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Tier 1 inputs */}
          {tier === "tier1" && (
            <div>
              <Label className="text-sm font-medium">Gas Added to System (kg)</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.amount_added_kg} onChange={e => set("amount_added_kg", e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Enter the exact amount topped up during maintenance. Source: service technician's report.</p>
            </div>
          )}

          {/* Tier 2 inputs */}
          {tier === "tier2" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Equipment Category</Label>
                <Select value={form.equipment_category} onValueChange={v => set("equipment_category", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(LEAK_RATES).map(([k, v]) => <SelectItem key={k} value={k}>{k} — {v}% default leak rate</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Charge Capacity (kg)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.equipment_capacity_kg} onChange={e => set("equipment_capacity_kg", e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Found on the equipment nameplate or installation records.</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
                Default annual leak rate for <strong>{form.equipment_category}</strong>: <strong>{LEAK_RATES[form.equipment_category] || 5}%</strong>. Emissions = Capacity × Leak Rate × GWP.
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input className="mt-1" placeholder="Service report reference, technician name..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Result */}
          {tco2e > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Scope 1 Fugitive Emissions</div>
                  <div className="text-2xl font-bold text-emerald-800">{tco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
                </div>
                <QualityBadge score={score} label={score >= 9 ? "Gold" : "Silver"} />
              </div>
              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  <div><span className="font-semibold">Method:</span> {method}</div>
                  <div><span className="font-semibold">GWP Source:</span> IPCC AR6 (100-year)</div>
                  <div><span className="font-semibold">Standard:</span> GHG Protocol Scope 1 · ISO 14064-1</div>
                  <div className="text-slate-400">No Scope 3 Category 3 triggered — fugitive emissions classification only.</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || tco2e === 0}>
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}