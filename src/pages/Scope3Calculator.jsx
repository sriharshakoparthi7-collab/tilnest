import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calculator, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DATA_TIERS = [
  { value: "Tier 1 - EPD/LCA", label: "Tier 1 — EPD / LCA (Gold)", score: 10, color: "text-emerald-700 bg-emerald-50 border-emerald-200", desc: "Supplier provides full Environmental Product Declaration" },
  { value: "Tier 2 - Scope1+2 + BOM", label: "Tier 2 — S1+S2 + BOM (Silver)", score: 8, color: "text-blue-700 bg-blue-50 border-blue-200", desc: "Supplier provides Scope 1+2 emissions and Bill of Materials" },
  { value: "Tier 3 - BOM Only", label: "Tier 3 — BOM Only", score: 6, color: "text-amber-700 bg-amber-50 border-amber-200", desc: "Supplier provides Bill of Materials only" },
  { value: "Tier 4 - Spend-based", label: "Tier 4 — Spend-based (Bronze)", score: 2, color: "text-orange-700 bg-orange-50 border-orange-200", desc: "Only financial spend data available" },
];

const UI_CATEGORIES = ["Energy", "Travel", "Goods & Services", "Waste & Reuse", "Employees", "Refrigerants", "Water"];
const TRANSPORT_MODES = ["Heavy Truck", "Light Van", "Rail", "Sea Freight", "Air Freight"];
const SECTORS = ["Manufacturing", "Construction", "Mining", "Agriculture", "Transport", "Services", "Retail", "Default"];

const QUALITY_COLORS = { 10: "#10b981", 9: "#10b981", 8: "#3b82f6", 7: "#3b82f6", 6: "#f59e0b", 5: "#f59e0b", 4: "#f97316", 3: "#f97316", 2: "#ef4444", 1: "#ef4444" };

function ResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const color = QUALITY_COLORS[result.Data_Quality_Rating] || "#94a3b8";
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: color }} />
          <div>
            <div className="text-xs text-slate-500 font-medium">{result.GHG_Category}</div>
            <div className="text-lg font-bold text-slate-900">
              {result.Total_tCO2e} tCO₂e
              {result.Avoided_tCO2e_Credit > 0 && (
                <span className="ml-2 text-sm font-normal text-emerald-600">− {result.Avoided_tCO2e_Credit} t credit</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400">Data Quality</div>
            <div className="font-bold text-sm" style={{ color }}>{result.Data_Quality_Rating}/10</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-2 text-sm">
          <div className="flex gap-2"><span className="text-slate-500 w-36 flex-shrink-0">UI Section:</span><span className="font-medium">{result.UI_Section}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-36 flex-shrink-0">Allocation Method:</span><span className="font-medium">{result.Allocation_Method}</span></div>
          {result.Net_tCO2e !== undefined && (
            <div className="flex gap-2"><span className="text-slate-500 w-36 flex-shrink-0">Net (after credit):</span><span className="font-bold text-emerald-700">{result.Net_tCO2e} tCO₂e</span></div>
          )}
          {result.C2C_Material_Breakdown && (
            <div>
              <div className="text-slate-500 mb-1">C2C Material Breakdown:</div>
              <table className="w-full text-xs">
                <thead><tr className="text-slate-400">{["Material", "Mass (kg)", "Recovery %", "EoL tCO₂e", "Avoided tCO₂e"].map(h => <th key={h} className="text-left py-1 pr-3">{h}</th>)}</tr></thead>
                <tbody>
                  {result.C2C_Material_Breakdown.map((m, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 pr-3 font-medium">{m.material}</td>
                      <td className="py-1 pr-3">{m.total_mass_kg}</td>
                      <td className="py-1 pr-3">{m.recovery_rate_pct}%</td>
                      <td className="py-1 pr-3 text-amber-600">{m.eol_tco2e}</td>
                      <td className="py-1 pr-3 text-emerald-600">−{m.avoided_tco2e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 flex-wrap pt-1">
            {result.Audit_Trail.map(a => (
              <span key={a} className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scope3Calculator() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({
    description: "", ui_category: "Goods & Services", quantity: "", unit_mass_kg: "",
    supplier_name: "", spend_usd: "", sector_code: "Manufacturing",
    data_tier: "Tier 4 - Spend-based",
    supplier_tco2e: "", supplier_scope1_2_tco2e: "",
    supplier_total_output_kg: "", supplier_revenue_usd: "",
    bom_materials: [],
    delivery_terms: "Supplier Delivered (DDP)", transport_distance_km: "", transport_mode: "Heavy Truck",
    is_c2c: false, reporting_year: 2024,
  });
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bomRow, setBomRow] = useState({ material: "", mass_kg: "", emission_factor_kgco2e_per_kg: "" });

  const load = () => base44.entities.PurchaseEntry.list("-created_date", 20).then(setEntries);
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addBomRow = () => {
    if (!bomRow.material) return;
    set("bom_materials", [...form.bom_materials, { ...bomRow, mass_kg: parseFloat(bomRow.mass_kg) || 0, emission_factor_kgco2e_per_kg: parseFloat(bomRow.emission_factor_kgco2e_per_kg) || 0 }]);
    setBomRow({ material: "", mass_kg: "", emission_factor_kgco2e_per_kg: "" });
  };
  const removeBomRow = (idx) => set("bom_materials", form.bom_materials.filter((_, i) => i !== idx));

  const calculate = async () => {
    setCalculating(true);
    setResult(null);
    const entry = {
      ...form,
      quantity: parseFloat(form.quantity) || 1,
      unit_mass_kg: parseFloat(form.unit_mass_kg) || 0,
      spend_usd: parseFloat(form.spend_usd) || 0,
      supplier_tco2e: parseFloat(form.supplier_tco2e) || 0,
      supplier_scope1_2_tco2e: parseFloat(form.supplier_scope1_2_tco2e) || 0,
      supplier_total_output_kg: parseFloat(form.supplier_total_output_kg) || 0,
      supplier_revenue_usd: parseFloat(form.supplier_revenue_usd) || 0,
      transport_distance_km: parseFloat(form.transport_distance_km) || 0,
    };
    const res = await base44.functions.invoke("calculateScope3", { entry });
    setResult(res.data?.output);
    setCalculating(false);
  };

  const save = async () => {
    setSaving(true);
    const entry = {
      ...form,
      quantity: parseFloat(form.quantity) || 1,
      unit_mass_kg: parseFloat(form.unit_mass_kg) || 0,
      spend_usd: parseFloat(form.spend_usd) || 0,
      supplier_tco2e: parseFloat(form.supplier_tco2e) || 0,
      supplier_scope1_2_tco2e: parseFloat(form.supplier_scope1_2_tco2e) || 0,
      supplier_total_output_kg: parseFloat(form.supplier_total_output_kg) || 0,
      supplier_revenue_usd: parseFloat(form.supplier_revenue_usd) || 0,
      transport_distance_km: parseFloat(form.transport_distance_km) || 0,
      result_json: result ? JSON.stringify(result) : undefined,
      status: result ? "Calculated" : "Draft",
    };
    await base44.entities.PurchaseEntry.create(entry);
    setSaving(false);
    setResult(null);
    setForm(f => ({ ...f, description: "", quantity: "", unit_mass_kg: "", spend_usd: "", bom_materials: [] }));
    load();
  };

  const tierInfo = DATA_TIERS.find(t => t.value === form.data_tier);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-emerald-600" /> PRAMAE GHG Calculator
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">GHG Protocol + ISO 14064 · Cradle-to-Cradle · Australian NGA 2025 Factors</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ─── INPUT FORM ─── */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Entry Details</h2>

            <div>
              <Label className="text-sm font-medium">Description *</Label>
              <Input className="mt-1" placeholder="e.g. 100 x Office Chairs, 10kg each" value={form.description} onChange={e => set("description", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">UI Category</Label>
                <Select value={form.ui_category} onValueChange={v => set("ui_category", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{UI_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Quantity</Label>
                <Input type="number" className="mt-1" placeholder="100" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Unit Mass (kg each)</Label>
                <Input type="number" className="mt-1" placeholder="10" value={form.unit_mass_kg} onChange={e => set("unit_mass_kg", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Supplier Name</Label>
                <Input className="mt-1" placeholder="e.g. ACME Pty Ltd" value={form.supplier_name} onChange={e => set("supplier_name", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Data Tier selection */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-slate-800">Data Quality Tier</h2>
            <div className="space-y-2">
              {DATA_TIERS.map(t => (
                <label key={t.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.data_tier === t.value ? t.color + " border-current" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="tier" checked={form.data_tier === t.value} onChange={() => set("data_tier", t.value)} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{t.label}</span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60">Score: {t.score}/10</span>
                    </div>
                    <div className="text-xs opacity-75 mt-0.5">{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Tier-specific fields */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Tier-specific Data</h2>

            {form.data_tier === "Tier 1 - EPD/LCA" && (
              <div>
                <Label className="text-sm font-medium">Supplier-provided tCO₂e (per unit)</Label>
                <Input type="number" className="mt-1" placeholder="0.000" value={form.supplier_tco2e} onChange={e => set("supplier_tco2e", e.target.value)} />
              </div>
            )}

            {form.data_tier === "Tier 2 - Scope1+2 + BOM" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Supplier total S1+S2 (tCO₂e/year)</Label>
                  <Input type="number" className="mt-1" placeholder="0.000" value={form.supplier_scope1_2_tco2e} onChange={e => set("supplier_scope1_2_tco2e", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Factory output (kg/year)</Label>
                    <Input type="number" className="mt-1" placeholder="e.g. 500000" value={form.supplier_total_output_kg} onChange={e => set("supplier_total_output_kg", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Supplier revenue (USD/year)</Label>
                    <Input type="number" className="mt-1" placeholder="fallback" value={form.supplier_revenue_usd} onChange={e => set("supplier_revenue_usd", e.target.value)} />
                  </div>
                </div>
                <div className="text-xs text-blue-600 flex items-center gap-1.5"><Info className="w-3 h-3" /> Mass-based allocation applied. Economic fallback used if mass unavailable.</div>
              </div>
            )}

            {form.data_tier === "Tier 4 - Spend-based" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Spend (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0.00" value={form.spend_usd} onChange={e => set("spend_usd", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Sector</Label>
                  <Select value={form.sector_code} onValueChange={v => set("sector_code", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 text-xs text-amber-600 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Safety factor of 1.1× applied per GHG Protocol guidance.</div>
              </div>
            )}
          </div>

          {/* BOM Section */}
          {(form.data_tier === "Tier 2 - Scope1+2 + BOM" || form.data_tier === "Tier 3 - BOM Only" || form.is_c2c) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-slate-800">Bill of Materials</h2>
              {form.bom_materials.map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <span className="flex-1 font-medium">{m.material}</span>
                  <span className="text-slate-500">{m.mass_kg} kg</span>
                  <span className="text-slate-500">{m.emission_factor_kgco2e_per_kg} kgCO₂e/kg</span>
                  <button onClick={() => removeBomRow(i)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Material (e.g. Steel)" value={bomRow.material} onChange={e => setBomRow(b => ({ ...b, material: e.target.value }))} className="text-sm" />
                <Input type="number" placeholder="Mass (kg/unit)" value={bomRow.mass_kg} onChange={e => setBomRow(b => ({ ...b, mass_kg: e.target.value }))} className="text-sm" />
                <Input type="number" placeholder="EF (kgCO₂e/kg)" value={bomRow.emission_factor_kgco2e_per_kg} onChange={e => setBomRow(b => ({ ...b, emission_factor_kgco2e_per_kg: e.target.value }))} className="text-sm" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={addBomRow}><Plus className="w-3.5 h-3.5" /> Add Material Row</Button>
            </div>
          )}

          {/* Transport Section */}
          {form.ui_category === "Goods & Services" && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-slate-800">Upstream Transport (Cat 4)</h2>
              <div>
                <Label className="text-sm font-medium">Delivery Terms</Label>
                <Select value={form.delivery_terms} onValueChange={v => set("delivery_terms", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supplier Delivered (DDP)">Supplier Delivered (DDP) — bundled into Cat 1</SelectItem>
                    <SelectItem value="Ex-Works / Client Pick-up">Ex-Works / Client Pick-up — separate Cat 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.delivery_terms === "Ex-Works / Client Pick-up" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Distance (km)</Label>
                    <Input type="number" className="mt-1" placeholder="500" value={form.transport_distance_km} onChange={e => set("transport_distance_km", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Mode</Label>
                    <Select value={form.transport_mode} onValueChange={v => set("transport_mode", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{TRANSPORT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* C2C Toggle */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_c2c} onChange={e => set("is_c2c", e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              <div>
                <div className="font-semibold text-slate-800 text-sm">Apply Cradle-to-Cradle (C2C) Analysis</div>
                <div className="text-xs text-slate-500">Calculates Cat 12 End-of-Life using Australian NGA recovery rates + circularity credits</div>
              </div>
            </label>
          </div>

          <Button onClick={calculate} disabled={calculating || !form.description} className="w-full h-11 gap-2 text-base">
            {calculating ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</> : <><Calculator className="w-4 h-4" /> Run GHG Calculation</>}
          </Button>
        </div>

        {/* ─── RESULTS ─── */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">Total Emissions</div>
                <div className="text-4xl font-bold text-emerald-900">{result.total_tco2e} <span className="text-lg font-normal">tCO₂e</span></div>
                <div className="text-xs text-emerald-600 mt-1">{result.description} · {result.ui_category} · {result.data_tier}</div>
                <div className="text-xs text-slate-400 mt-1">{new Date(result.calculated_at).toLocaleString("en-AU")}</div>
              </div>

              <div className="space-y-2">
                {result.line_items.map((r, i) => <ResultCard key={i} result={r} />)}
              </div>

              <Button onClick={save} disabled={saving} variant="outline" className="w-full gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {saving ? "Saving..." : "Save to Inventory"}
              </Button>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 min-h-48 flex flex-col items-center justify-center">
              <Calculator className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Fill in the form and run the calculation</p>
              <p className="text-xs mt-1 max-w-xs">Results will show GHG Protocol categories, data quality score, allocation method and full audit trail</p>
            </div>
          )}

          {/* Past Calculations */}
          {entries.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Previous Calculations</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {entries.slice(0, 8).map(e => {
                  let parsed = null;
                  try { parsed = e.result_json ? JSON.parse(e.result_json) : null; } catch {}
                  return (
                    <div key={e.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{e.description}</div>
                          <div className="text-xs text-slate-400">{e.ui_category} · {e.data_tier}</div>
                        </div>
                        <div className="text-right">
                          {parsed ? (
                            <div className="text-sm font-bold text-slate-800">{parsed.total_tco2e} tCO₂e</div>
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Draft</span>
                          )}
                          <div className="text-xs text-slate-400 mt-0.5">{e.status}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}