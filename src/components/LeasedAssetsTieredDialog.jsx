import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const CBPS_INTENSITY = { "Office": 185, "Warehouse": 85, "Retail": 210, "Industrial": 150, "Healthcare": 380, "Hospitality": 340, "Educational": 120, "Other": 150 };
function estimateElectricity(buildingType, _zone, areaSqm) {
  const intensityFactor = CBPS_INTENSITY[buildingType] || 150;
  return { intensityFactor, estimatedKwh: areaSqm * intensityFactor };
}

const BUILDING_TYPES = ["Office", "Warehouse", "Retail", "Industrial", "Healthcare", "Hospitality", "Educational", "Other"];
const CLIMATE_ZONES = ["Zone 1","Zone 2","Zone 3","Zone 4","Zone 5","Zone 6","Zone 7"];
const AUS_GRID = 0.79;

const TIERS = [
  { key: "tier1", label: "Tier 1: Metered Asset Data (Gold)", sub: "We have actual sub-metered electricity/gas data for the specific leased space.", score: 9 },
  { key: "tier2", label: "Tier 2: Apportioned Building Area (Silver)", sub: "Estimate based on the leased floor area using CBPS/NCC building intensity data.", score: 6 },
  { key: "tier3", label: "Tier 3: Lease Spend (Estimated)", sub: "We only know the financial cost of the lease.", score: 2 },
];

function QualityBadge({ score }) {
  const cfg = score >= 9 ? "bg-amber-100 text-amber-700 border-amber-300" : score >= 6 ? "bg-slate-100 text-slate-600 border-slate-300" : "bg-red-50 text-red-600 border-red-200";
  const label = score >= 9 ? "Gold" : score >= 6 ? "Silver" : "Estimated";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function LeasedAssetsTieredDialog({ open, onClose, onSaved, leaseType = "Upstream" }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier2");
  const [form, setForm] = useState({
    source_name: "", location_id: "", start_date: "", end_date: "", notes: "", status: "Draft",
    metered_kwh: "", metered_gas_m3: "",
    building_type: "Office", floor_area_sqm: "", ncc_climate_zone: "Zone 5",
    lease_spend: "", currency: "USD",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const cat = leaseType === "Upstream" ? "Upstream Leased Assets" : "Downstream Leased Assets";
  const catNum = leaseType === "Upstream" ? 8 : 13;

  let tco2e = 0, method = "", score = TIERS.find(t => t.key === tier)?.score || 6, cbpsIntensity = 0;

  if (tier === "tier1") {
    const elec = (parseFloat(form.metered_kwh) || 0) * AUS_GRID / 1000;
    const gas = (parseFloat(form.metered_gas_m3) || 0) * 2.04 / 1000;
    tco2e = elec + gas;
    method = `Metered: ${form.metered_kwh || 0} kWh × 0.79 + ${form.metered_gas_m3 || 0} m³ × 2.04 kgCO₂e/m³`;
    score = 9;
  } else if (tier === "tier2") {
    const est = estimateElectricity(form.building_type, form.ncc_climate_zone, parseFloat(form.floor_area_sqm) || 0);
    cbpsIntensity = est.intensityFactor;
    tco2e = est.estimatedKwh * AUS_GRID / 1000;
    method = `CBPS/NCC: ${form.floor_area_sqm || 0} m² × ${cbpsIntensity} kWh/m² × 0.79 kgCO₂e/kWh`;
    score = 6;
  } else {
    tco2e = (parseFloat(form.lease_spend) || 0) * 0.00065;
    method = "Spend-based · EEIO Real Estate sector";
    score = 2;
  }

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    await base44.entities.EmissionEntry.create({
      scope: "Scope 3", category: cat, s3_category_number: catNum,
      sub_category: leaseType,
      source_name: form.source_name || `${leaseType} Leased Asset`,
      location_id: form.location_id, location_name: loc?.name || "",
      start_date: form.start_date, end_date: form.end_date,
      building_type: form.building_type,
      ncc_climate_zone: tier === "tier2" ? form.ncc_climate_zone : undefined,
      facility_sqft: tier === "tier2" ? (parseFloat(form.floor_area_sqm) || undefined) : undefined,
      quantity: tier === "tier1" ? (parseFloat(form.metered_kwh) || undefined) : undefined,
      unit: tier === "tier1" ? "kWh" : undefined,
      financial_spend: parseFloat(form.lease_spend) || undefined, currency: form.currency,
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
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Cat {catNum} · {leaseType} Leased Assets</div>
            <h2 className="text-lg font-bold text-slate-900">Add {leaseType} Leased Asset</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Asset / Building Name</Label>
              <Input className="mt-1" placeholder="e.g. Level 3 Office Suite" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
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
              <Label className="text-sm font-medium">Lease Start</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Lease End</Label>
              <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-800 mb-3">Data Quality Tier</div>
            <div className="space-y-2">
              {TIERS.map(t => (
                <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                  <input type="radio" name="lease_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Metered Electricity (kWh)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.metered_kwh} onChange={e => set("metered_kwh", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Metered Gas (m³)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.metered_gas_m3} onChange={e => set("metered_gas_m3", e.target.value)} />
              </div>
            </div>
          )}

          {tier === "tier2" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Building Type</Label>
                <Select value={form.building_type} onValueChange={v => set("building_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{BUILDING_TYPES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Leased Floor Area (m²)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.floor_area_sqm} onChange={e => set("floor_area_sqm", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">NCC Climate Zone</Label>
                  <Select value={form.ncc_climate_zone} onValueChange={v => set("ncc_climate_zone", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CLIMATE_ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {cbpsIntensity > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs text-orange-700">
                  CBPS Intensity Factor: <strong>{cbpsIntensity} kWh/m²/year</strong>
                </div>
              )}
            </div>
          )}

          {tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Annual Lease Cost</Label>
                <Input type="number" className="mt-1" placeholder="0.00" value={form.lease_spend} onChange={e => set("lease_spend", e.target.value)} />
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
            <Input className="mt-1" placeholder="Lease agreement ref..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {tco2e > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Scope 3 Cat {catNum} Emissions</div>
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
                  <div><span className="font-semibold">Category:</span> Scope 3, Cat {catNum} — {leaseType} Leased Assets</div>
                  <div className="text-slate-400 mt-1">References: CBPS 2024 · NCC Climate Zones · AUS NGA 2024 · GHG Protocol Cat {catNum}</div>
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