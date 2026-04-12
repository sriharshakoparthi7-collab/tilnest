import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const AUS_GRID = 0.79;
const GAS_EF = 2.04;

const TIERS = [
  { key: "tier1", label: "Tier 1: Franchisee Metered Data (Gold)", sub: "The franchisee reports their actual Scope 1 & 2 energy bills back to head office.", score: 9 },
  { key: "tier2", label: "Tier 2: Franchise Physical Estimate (Silver)", sub: "Estimate based on the franchise's floor area or headcount.", score: 6 },
  { key: "tier3", label: "Tier 3: Franchise Revenue (Estimated)", sub: "Estimate based on the gross revenue the franchise generates.", score: 2 },
];

function QualityBadge({ score }) {
  const cfg = score >= 9 ? "bg-amber-100 text-amber-700 border-amber-300" : score >= 6 ? "bg-slate-100 text-slate-600 border-slate-300" : "bg-red-50 text-red-600 border-red-200";
  const label = score >= 9 ? "Gold" : score >= 6 ? "Silver" : "Estimated";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function FranchisesDialog({ open, onClose, onSaved }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier1");
  const [form, setForm] = useState({
    franchise_name: "", franchise_location: "", start_date: "", end_date: "", notes: "", status: "Draft",
    reported_kwh: "", reported_gas_m3: "",
    floor_area_sqm: "", headcount: "",
    gross_revenue: "", currency: "AUD",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  let tco2e = 0, method = "", score = TIERS.find(t => t.key === tier)?.score || 9;

  if (tier === "tier1") {
    const elec = (parseFloat(form.reported_kwh) || 0) * AUS_GRID / 1000;
    const gas = (parseFloat(form.reported_gas_m3) || 0) * GAS_EF / 1000;
    tco2e = elec + gas;
    method = `Franchisee-reported: ${form.reported_kwh || 0} kWh × 0.79 + ${form.reported_gas_m3 || 0} m³ gas × 2.04 kgCO₂e`;
    score = 9;
  } else if (tier === "tier2") {
    const area = parseFloat(form.floor_area_sqm) || 0;
    const headcount = parseFloat(form.headcount) || 0;
    const intensityFactor = 185; // kWh/m²/yr for general retail
    const estimatedKwh = area > 0 ? area * intensityFactor : headcount * 2500;
    tco2e = estimatedKwh * AUS_GRID / 1000;
    method = `Floor area/headcount estimate: ${area > 0 ? `${area} m² × ${intensityFactor} kWh/m²` : `${headcount} staff × 2500 kWh`} × 0.79`;
    score = 6;
  } else {
    tco2e = (parseFloat(form.gross_revenue) || 0) * 0.00035;
    method = "Revenue-based · EEIO franchise sector factor";
    score = 2;
  }

  const save = async () => {
    setSaving(true);
    await base44.entities.EmissionEntry.create({
      scope: "Scope 3", category: "Franchises", s3_category_number: 14,
      source_name: form.franchise_name,
      location_name: form.franchise_location,
      start_date: form.start_date, end_date: form.end_date,
      quantity: tier === "tier1" ? (parseFloat(form.reported_kwh) || undefined) : (parseFloat(form.floor_area_sqm) || undefined),
      unit: tier === "tier1" ? "kWh" : "m²",
      amount_paid: parseFloat(form.gross_revenue) || undefined,
      currency: form.currency,
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
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Category 14 · Franchises</div>
            <h2 className="text-lg font-bold text-slate-900">Add Franchise Emission Entry</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Franchise Name</Label>
              <Input className="mt-1" placeholder="e.g. Store #42 Melbourne" value={form.franchise_name} onChange={e => set("franchise_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Franchise Location / Region</Label>
              <Input className="mt-1" placeholder="e.g. Victoria, Australia" value={form.franchise_location} onChange={e => set("franchise_location", e.target.value)} />
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
                  <input type="radio" name="franchise_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
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
                <Label className="text-sm font-medium">Reported Electricity (kWh)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.reported_kwh} onChange={e => set("reported_kwh", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Reported Gas (m³)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.reported_gas_m3} onChange={e => set("reported_gas_m3", e.target.value)} />
              </div>
            </div>
          )}

          {tier === "tier2" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Floor Area (m²)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.floor_area_sqm} onChange={e => set("floor_area_sqm", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Headcount (if no floor area)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.headcount} onChange={e => set("headcount", e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-slate-400">System applies 185 kWh/m²/yr (general retail/franchise) · AUS grid factor.</p>
            </div>
          )}

          {tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Gross Revenue</Label>
                <Input type="number" className="mt-1" placeholder="0.00" value={form.gross_revenue} onChange={e => set("gross_revenue", e.target.value)} />
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
            <Input className="mt-1" placeholder="Franchisee reporting period, utility bill ref..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {tco2e > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Scope 3 Cat 14 Franchise Emissions</div>
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
                  <div className="text-slate-400 mt-1">References: AUS NGA 2024 · CBPS · GHG Protocol Cat 14</div>
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