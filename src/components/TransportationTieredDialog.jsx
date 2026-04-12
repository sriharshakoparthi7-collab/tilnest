import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const MODE_FACTORS = { "Road - Heavy Goods": 0.096, "Rail": 0.028, "Sea (Container)": 0.011, "Air Freight": 0.602 };

const TIERS = [
  { key: "tier1", label: "Tier 1: Carrier-Specific Telematics (Gold)", sub: "We have exact fuel usage or a carbon report from our logistics provider for these shipments.", score: 9 },
  { key: "tier2", label: "Tier 2: Distance & Weight Method (Silver)", sub: "We know the exact weight of the goods, the distance traveled, and the mode of transport.", score: 7 },
  { key: "tier3", label: "Tier 3: Spend-Based Freight (Estimated)", sub: "We only know how much we paid the freight company.", score: 2 },
];

function QualityBadge({ score }) {
  const cfg = score >= 9 ? "bg-amber-100 text-amber-700 border-amber-300" : score >= 7 ? "bg-slate-100 text-slate-600 border-slate-300" : "bg-red-50 text-red-600 border-red-200";
  const label = score >= 9 ? "Gold" : score >= 7 ? "Silver" : "Estimated";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · {score}/10</span>;
}

export default function TransportationTieredDialog({ open, onClose, onSaved, direction = "Upstream" }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [tier, setTier] = useState("tier2");
  const [form, setForm] = useState({
    source_name: "", location_id: "", start_date: "", notes: "", status: "Draft",
    logistics_provider: "",
    provider_reported_co2e: "", exact_fuel_volume: "", fuel_type: "Diesel",
    transport_weight_kg: "", transport_distance_km: "", transport_mode: "Road - Heavy Goods",
    origin_address: "", destination_address: "",
    freight_spend: "", currency: "USD", spend_year: "2024",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const cat = direction === "Upstream" ? "Upstream Transportation & Distribution" : "Downstream Transportation & Distribution";
  const catNum = direction === "Upstream" ? 4 : 9;

  let tco2e = 0, method = "", score = TIERS.find(t => t.key === tier)?.score || 7;
  if (tier === "tier1") {
    tco2e = parseFloat(form.provider_reported_co2e) || (parseFloat(form.exact_fuel_volume) || 0) * 2.68 / 1000;
    method = form.provider_reported_co2e ? "Provider-reported CO₂e" : "Exact fuel × combustion factor";
    score = 9;
  } else if (tier === "tier2") {
    const mf = MODE_FACTORS[form.transport_mode] || 0.096;
    const tkm = (parseFloat(form.transport_weight_kg) || 0) / 1000 * (parseFloat(form.transport_distance_km) || 0);
    tco2e = tkm * mf / 1000;
    method = `${form.transport_mode} · ${(parseFloat(form.transport_weight_kg)||0)/1000} t × ${form.transport_distance_km || 0} km × ${mf} kgCO₂e/tkm`;
    score = 7;
  } else {
    tco2e = (parseFloat(form.freight_spend) || 0) * (MODE_FACTORS[form.transport_mode] || 0.096) * 0.5 / 1000;
    method = "Spend-based · EEIO freight factor";
    score = 2;
  }

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const tkm = tier === "tier2" ? (parseFloat(form.transport_weight_kg)||0)/1000 * (parseFloat(form.transport_distance_km)||0) : undefined;
    await base44.entities.EmissionEntry.create({
      scope: "Scope 3", category: cat, s3_category_number: catNum,
      sub_category: direction,
      source_name: form.source_name || `${direction} Transport`,
      location_id: form.location_id, location_name: loc?.name || "",
      supplier: form.logistics_provider,
      start_date: form.start_date,
      shipment_weight_kg: parseFloat(form.transport_weight_kg) || undefined,
      transport_mode: form.transport_mode,
      transport_distance_km: parseFloat(form.transport_distance_km) || undefined,
      tonne_km: tkm ? parseFloat(tkm.toFixed(4)) : undefined,
      cat4_tco2e: catNum === 4 ? parseFloat(tco2e.toFixed(6)) : undefined,
      origin_address: form.origin_address, destination_address: form.destination_address,
      financial_spend: parseFloat(form.freight_spend) || undefined, currency: form.currency,
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
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Cat {catNum} · {direction} Transportation</div>
            <h2 className="text-lg font-bold text-slate-900">Add {direction} Transport Entry</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Shipment / Route Description</Label>
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
              <Label className="text-sm font-medium">Date</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Logistics Provider</Label>
              <Input className="mt-1" placeholder="e.g. DHL, Toll, TNT" value={form.logistics_provider} onChange={e => set("logistics_provider", e.target.value)} />
            </div>
          </div>

          {/* Tier Selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-800 mb-3">Data Quality Tier</div>
            <div className="space-y-2">
              {TIERS.map(t => (
                <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${tier === t.key ? "bg-white border border-blue-300 shadow-sm" : "hover:bg-blue-100/50"}`}>
                  <input type="radio" name="trans_tier" className="mt-0.5 accent-blue-600" checked={tier === t.key} onChange={() => setTier(t.key)} />
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

          {/* Tier 1 */}
          {tier === "tier1" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Provider-Reported CO₂e (tCO₂e) — if available</Label>
                <Input type="number" className="mt-1" placeholder="0.000" value={form.provider_reported_co2e} onChange={e => set("provider_reported_co2e", e.target.value)} />
              </div>
              <div className="text-xs text-slate-500 text-center">— or enter exact fuel data —</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Exact Fuel Volume (L)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.exact_fuel_volume} onChange={e => set("exact_fuel_volume", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Fuel Type</Label>
                  <Select value={form.fuel_type} onValueChange={v => set("fuel_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Diesel","Petrol","LNG","CNG","SAF"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Tier 2 */}
          {tier === "tier2" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Transport Mode</Label>
                <Select value={form.transport_mode} onValueChange={v => set("transport_mode", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MODE_FACTORS).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v} kgCO₂e/tkm)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Shipment Weight (kg)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.transport_weight_kg} onChange={e => set("transport_weight_kg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Distance (km)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.transport_distance_km} onChange={e => set("transport_distance_km", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Origin</Label>
                  <Input className="mt-1" placeholder="City / address" value={form.origin_address} onChange={e => set("origin_address", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Destination</Label>
                  <Input className="mt-1" placeholder="City / address" value={form.destination_address} onChange={e => set("destination_address", e.target.value)} />
                </div>
              </div>
              {(parseFloat(form.transport_weight_kg) > 0 && parseFloat(form.transport_distance_km) > 0) && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-600">
                  Tonne-Kilometres: <strong>{((parseFloat(form.transport_weight_kg)||0)/1000 * (parseFloat(form.transport_distance_km)||0)).toFixed(2)} tkm</strong>
                </div>
              )}
            </div>
          )}

          {/* Tier 3 */}
          {tier === "tier3" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Transport Mode (for EEIO mapping)</Label>
                <Select value={form.transport_mode} onValueChange={v => set("transport_mode", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(MODE_FACTORS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Freight Spend</Label>
                  <Input type="number" className="mt-1" placeholder="0.00" value={form.freight_spend} onChange={e => set("freight_spend", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Currency</Label>
                  <Select value={form.currency} onValueChange={v => set("currency", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["USD","AUD","EUR","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <Input className="mt-1" placeholder="Bill of lading, carrier ref..." value={form.notes} onChange={e => set("notes", e.target.value)} />
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
                  <div><span className="font-semibold">Category:</span> Scope 3, Category {catNum} — {direction} T&D</div>
                  <div className="text-slate-400 mt-1">References: DEFRA 2024 · GHG Protocol Cat {catNum} · NTM</div>
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