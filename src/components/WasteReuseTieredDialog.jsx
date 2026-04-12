import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const WASTE_MATERIALS = ["General / Mixed", "Cardboard / Paper", "Food Organics", "E-Waste", "Plastics", "Metal", "Glass", "Construction Debris", "Chemical / Hazardous"];
const TREATMENT_METHODS = {
  "Landfill": 1.91, "Recycled": 0.04, "Composted": 0.19, "Incinerated": 0.56,
  "Reused": 0.00, "Wastewater Treatment": 0.52, "Energy Recovery": 0.30,
};
const TIERS = [
  { key: "tier1", label: "Tier 1: Verified Waste Provider Report (Gold)", sub: "Our waste company provides a specific carbon footprint report for our waste.", score: 9 },
  { key: "tier2", label: "Tier 2: Waste Type & Weight (Silver)", sub: "We know the exact weight of our waste and how it was disposed of.", score: 7 },
  { key: "tier3", label: "Tier 3: Waste Spend (Estimated)", sub: "We only know our financial spend on waste collection services.", score: 2 },
];

function QualityBadge({ score }) {
  const cfg = score >= 9 ? "bg-amber-100 text-amber-700 border-amber-300" : score >= 7 ? "bg-slate-100 text-slate-600 border-slate-300" : "bg-red-50 text-red-600 border-red-200";
  const label = score >= 9 ? "Gold" : score >= 7 ? "Silver" : "Estimated";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function WasteReuseTieredDialog({ open, onClose, onSaved }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier2");
  const [form, setForm] = useState({
    source_name: "", location_id: "", start_date: "", end_date: "", notes: "", status: "Draft",
    provider_name: "", provider_reported_co2e: "",
    waste_material: "General / Mixed", weight_kg: "", treatment_method: "Landfill",
    waste_spend: "", currency: "USD",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  let tco2e = 0, method = "", score = TIERS.find(t => t.key === tier)?.score || 7;

  if (tier === "tier1") {
    tco2e = parseFloat(form.provider_reported_co2e) || 0;
    method = `Provider-reported: ${form.provider_name}`;
    score = 9;
  } else if (tier === "tier2") {
    const ef = TREATMENT_METHODS[form.treatment_method] ?? 1.91;
    tco2e = (parseFloat(form.weight_kg) || 0) * ef / 1000;
    method = `${form.waste_material} · ${form.treatment_method} · ${ef} kgCO₂e/kg — AUS NGA 2024`;
    score = 7;
  } else {
    tco2e = (parseFloat(form.waste_spend) || 0) * 0.00042;
    method = "Spend-based · EEIO waste management sector";
    score = 2;
  }

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    await base44.entities.EmissionEntry.create({
      scope: "Scope 3", category: "Waste Generated in Operations", s3_category_number: 5,
      source_name: form.source_name || form.waste_material,
      location_id: form.location_id, location_name: loc?.name || "",
      supplier: tier === "tier1" ? form.provider_name : form.treatment_method,
      start_date: form.start_date, end_date: form.end_date,
      quantity: tier === "tier2" ? (parseFloat(form.weight_kg) || undefined) : undefined,
      unit: "kg",
      financial_spend: parseFloat(form.waste_spend) || undefined, currency: form.currency,
      tco2e: parseFloat(tco2e.toFixed(6)),
      calculation_method: method,
      data_quality_tier: tier, data_quality_score: score,
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
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Category 5 · Waste in Operations</div>
            <h2 className="text-lg font-bold text-slate-900">Add Waste & Reuse Entry</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <Input className="mt-1" placeholder="e.g. Monthly office waste" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
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

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-800 mb-3">Data Quality Tier</div>
            <div className="space-y-2">
              {TIERS.map(t => (
                <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                  <input type="radio" name="waste_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
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
          </div>

          {tier === "tier1" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Waste Provider Name</Label>
                <Input className="mt-1" placeholder="e.g. Cleanaway, SUEZ" value={form.provider_name} onChange={e => set("provider_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Provider-Reported tCO₂e</Label>
                <Input type="number" className="mt-1" placeholder="0.000" value={form.provider_reported_co2e} onChange={e => set("provider_reported_co2e", e.target.value)} />
              </div>
            </div>
          )}

          {tier === "tier2" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Waste Material Category</Label>
                <Select value={form.waste_material} onValueChange={v => set("waste_material", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{WASTE_MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Weight (kg)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.weight_kg} onChange={e => set("weight_kg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Treatment Method</Label>
                  <Select value={form.treatment_method} onValueChange={v => set("treatment_method", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TREATMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v === 0 ? "Zero" : `${v} kgCO₂e/kg`})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {form.treatment_method === "Reused" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-700">
                  ✓ Reuse = 0 disposal emissions. This record will be logged as a landfill diversion achievement.
                </div>
              )}
            </div>
          )}

          {tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Waste Spend</Label>
                <Input type="number" className="mt-1" placeholder="0.00" value={form.waste_spend} onChange={e => set("waste_spend", e.target.value)} />
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
            <Label className="text-sm font-medium">Notes</Label>
            <Input className="mt-1" placeholder="Waste manifest ref, provider contract..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {(tco2e > 0 || tier === "tier2") && (parseFloat(form.provider_reported_co2e) > 0 || parseFloat(form.weight_kg) > 0 || parseFloat(form.waste_spend) > 0) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Scope 3 Cat 5 Emissions</div>
                  <div className="text-2xl font-bold text-emerald-800">{tco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
                </div>
                <QualityBadge score={score} />
              </div>
              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-600">
                  <div><span className="font-semibold">Method:</span> {method}</div>
                  <div className="text-slate-400 mt-1">References: AUS NGA Factors 2024 · GHG Protocol Cat 5</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || (tco2e === 0 && form.treatment_method !== "Reused")}>
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}