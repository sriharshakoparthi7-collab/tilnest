import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const TRANSPORT_EF = {
  "Car (Petrol)": 0.170, "Car (Diesel)": 0.168, "Car (EV)": 0.064,
  "Car (Hybrid)": 0.105, "Motorcycle": 0.114, "Bus": 0.089,
  "National Rail / Train": 0.041, "Subway / Metro": 0.028,
  "Bicycle / Walking": 0.000, "Work from Home": 0.012,
};
const WFH_EF = 0.012; // tCO₂e/day

const TIERS = [
  { key: "tier1", label: "Tier 1: Employee Commute Survey (Gold)", sub: "We surveyed our staff and know exactly how far they travel and what transport modes they use.", score: 8 },
  { key: "tier2", label: "Tier 2: Headcount & Regional Averages (Silver)", sub: "Estimate based on total employees and national commuting averages.", score: 5 },
  { key: "tier3", label: "Tier 3: Office Capacity Estimate (Bronze)", sub: "Estimate based purely on the maximum capacity of our office building.", score: 3 },
];

function QualityBadge({ score }) {
  const cfg = score >= 8 ? "bg-amber-100 text-amber-700 border-amber-300" : score >= 5 ? "bg-slate-100 text-slate-600 border-slate-300" : "bg-orange-100 text-orange-700 border-orange-300";
  const label = score >= 8 ? "Gold" : score >= 5 ? "Silver" : "Bronze";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function EmployeeCommutingDialog({ open, onClose, onSaved }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier2");
  const [surveyModes, setSurveyModes] = useState([{ mode: "Car (Petrol)", distance_km: "", days_per_year: "220" }]);
  const [form, setForm] = useState({
    location_id: "", start_date: "", notes: "", status: "Draft",
    total_employees_surveyed: "", teleworking_days: "",
    headcount: "", wfh_percentage: "20",
    max_desk_capacity: "", assumed_occupancy: "60",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const addMode = () => setSurveyModes(m => [...m, { mode: "Car (Petrol)", distance_km: "", days_per_year: "220" }]);
  const removeMode = (i) => setSurveyModes(m => m.filter((_, idx) => idx !== i));
  const updateMode = (i, k, v) => setSurveyModes(m => m.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  let tco2e = 0, method = "", score = TIERS.find(t => t.key === tier)?.score || 5;

  if (tier === "tier1") {
    tco2e = surveyModes.reduce((sum, row) => {
      const ef = TRANSPORT_EF[row.mode] ?? 0.170;
      const dist = parseFloat(row.distance_km) || 0;
      const days = parseFloat(row.days_per_year) || 220;
      return sum + dist * 2 * days * ef / 1000;
    }, 0);
    const wfh = (parseFloat(form.teleworking_days) || 0) * (parseFloat(form.total_employees_surveyed) || 1) * WFH_EF / 1000;
    tco2e += wfh;
    method = `Survey-based: ${surveyModes.length} modes · ${form.total_employees_surveyed || 0} employees · DEFRA 2024`;
    score = 8;
  } else if (tier === "tier2") {
    const n = parseFloat(form.headcount) || 0;
    const avgKm = 15, daysPerYear = 220;
    const driveShare = 0.70, transitShare = 0.20;
    const commuteTco2e = n * avgKm * 2 * daysPerYear * (driveShare * 0.170 + transitShare * 0.041) / 1000;
    const wfhDays = (parseFloat(form.wfh_percentage) || 0) / 100 * daysPerYear;
    const wfhTco2e = n * wfhDays * WFH_EF / 1000;
    tco2e = commuteTco2e + wfhTco2e;
    method = `Headcount: ${n} employees · 15km avg · 70% drive / 20% transit · ${form.wfh_percentage}% WFH`;
    score = 5;
  } else {
    const capacity = parseFloat(form.max_desk_capacity) || 0;
    const occupancy = (parseFloat(form.assumed_occupancy) || 60) / 100;
    const effectiveN = capacity * occupancy;
    const avgKm = 15, daysPerYear = 220;
    tco2e = effectiveN * avgKm * 2 * daysPerYear * (0.70 * 0.170 + 0.20 * 0.041) / 1000;
    method = `Capacity: ${capacity} desks × ${form.assumed_occupancy}% occupancy → ${effectiveN.toFixed(0)} FTE headcount estimate`;
    score = 3;
  }

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    await base44.entities.EmissionEntry.create({
      scope: "Scope 3", category: "Employee Commuting", s3_category_number: 7,
      source_name: "Employee Commuting",
      location_id: form.location_id, location_name: loc?.name || "",
      start_date: form.start_date,
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
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Category 7 · Employee Commuting</div>
            <h2 className="text-lg font-bold text-slate-900">Add Employee Commuting Entry</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Location</Label>
              <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Reporting Period Start</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-800 mb-3">Data Quality Tier</div>
            <div className="space-y-2">
              {TIERS.map(t => (
                <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                  <input type="radio" name="commute_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
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

          {/* Tier 1: Survey Data */}
          {tier === "tier1" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Employees Surveyed</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.total_employees_surveyed} onChange={e => set("total_employees_surveyed", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Teleworking Days / Employee / Year</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.teleworking_days} onChange={e => set("teleworking_days", e.target.value)} />
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-700">Transport Modes from Survey</div>
              {surveyModes.map((row, i) => (
                <div key={i} className="grid grid-cols-7 gap-2 items-end">
                  <div className="col-span-3">
                    {i === 0 && <Label className="text-xs mb-1 block">Mode</Label>}
                    <Select value={row.mode} onValueChange={v => updateMode(i, "mode", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(TRANSPORT_EF).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <Label className="text-xs mb-1 block">One-way km</Label>}
                    <Input type="number" className="h-8 text-xs" placeholder="0" value={row.distance_km} onChange={e => updateMode(i, "distance_km", e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    {i === 0 && <Label className="text-xs mb-1 block">Days/yr</Label>}
                    <Input type="number" className="h-8 text-xs" placeholder="220" value={row.days_per_year} onChange={e => updateMode(i, "days_per_year", e.target.value)} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {surveyModes.length > 1 && (
                      <button onClick={() => removeMode(i)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMode} className="gap-1.5 text-xs">
                <Plus className="w-3 h-3" /> Add Mode
              </Button>
            </div>
          )}

          {/* Tier 2: Headcount */}
          {tier === "tier2" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Total Headcount</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.headcount} onChange={e => set("headcount", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">WFH / Hybrid %</Label>
                <Input type="number" className="mt-1" placeholder="20" min="0" max="100" value={form.wfh_percentage} onChange={e => set("wfh_percentage", e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-slate-400">System applies national average: 15 km commute · 70% drive · 20% transit. WFH days use home energy factor (0.012 tCO₂e/day).</p>
            </div>
          )}

          {/* Tier 3: Capacity */}
          {tier === "tier3" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Max Desk Capacity</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.max_desk_capacity} onChange={e => set("max_desk_capacity", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Assumed Occupancy %</Label>
                <Input type="number" className="mt-1" placeholder="60" min="0" max="100" value={form.assumed_occupancy} onChange={e => set("assumed_occupancy", e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-orange-600">⚠️ Capacity-based estimates are penalized by auditors. Use as an absolute fallback only.</p>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <Input className="mt-1" placeholder="Survey period, assumptions..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {tco2e > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Scope 3 Cat 7 Emissions</div>
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
                  <div className="text-slate-400 mt-1">References: DEFRA GHG Factors 2024 · GHG Protocol Cat 7 · ABS Commuting Data</div>
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