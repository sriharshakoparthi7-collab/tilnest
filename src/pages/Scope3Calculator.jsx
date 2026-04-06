import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Calculator, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Star, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SECTORS = [
  "Steel / Metal Fabrication", "Aluminium", "Plastics", "Electronics",
  "Chemicals", "Textiles", "Food & Beverage", "Logistics / Freight",
  "Construction Materials", "Paper / Packaging", "Machinery", "IT Services",
  "Professional Services"
];

const MATERIALS = [
  "Steel", "Aluminium", "Copper", "Plastic", "Soft Plastic", "Paper",
  "Cardboard", "Timber", "Glass", "Rubber", "Concrete", "Composites"
];

const ITEM_TYPES = ["Consumable / Raw Material", "Asset / Machinery", "Fuel / Energy-Related", "Service"];
const DATA_TIERS = [
  "Tier 1 – EPD / Verified LCA",
  "Tier 2 – Supplier Scope 1&2 + BOM",
  "Tier 3 – BOM + Industry Averages",
  "Tier 4 – Spend-Based Only"
];

const TIER_COLORS = {
  "Tier 1 – EPD / Verified LCA": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Tier 2 – Supplier Scope 1&2 + BOM": "text-blue-700 bg-blue-50 border-blue-200",
  "Tier 3 – BOM + Industry Averages": "text-amber-700 bg-amber-50 border-amber-200",
  "Tier 4 – Spend-Based Only": "text-red-700 bg-red-50 border-red-200",
};

const DQ_STARS = { 10: 5, 9: 5, 8: 4, 7: 4, 6: 3, 5: 3, 4: 2, 3: 2, 2: 1, 1: 1 };

function DataQualityBadge({ score }) {
  const stars = DQ_STARS[score] || 1;
  const color = score >= 8 ? "text-emerald-600" : score >= 5 ? "text-amber-500" : "text-red-500";
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= stars ? color : "text-slate-200"}`} fill={i <= stars ? "currentColor" : "none"} />
      ))}
      <span className={`text-xs font-bold ml-1 ${color}`}>{score}/10</span>
    </div>
  );
}

function ResultPanel({ result, onSave, saving }) {
  const [showDetails, setShowDetails] = useState(false);
  if (!result) return null;

  const cat12 = result.Cat12_EndOfLife;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Total banner */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-blue-200 text-xs font-medium mb-0.5">Total Scope 3 Emissions</div>
            <div className="text-4xl font-bold">{result.Total_Emissions_kgCO2e.toLocaleString()}
              <span className="text-lg font-normal text-blue-200 ml-2">kgCO₂e</span>
            </div>
            <div className="text-blue-300 text-sm mt-0.5">= {result.Total_Emissions_tCO2e.toFixed(4)} tCO₂e</div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <div className="text-xs text-blue-200">Data Quality Score</div>
            <DataQualityBadge score={result.Data_Quality_Score} />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Category Split */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Category Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(result.Category_Split).map(([cat, val]) => {
              const total = result.Total_Emissions_kgCO2e || 1;
              const pct = ((val / total) * 100).toFixed(1);
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-slate-700">{cat}</span>
                    <span className="text-sm font-semibold text-slate-900">{val.toLocaleString()} kg <span className="text-xs text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Methodology */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Methodology</div>
          <div className="text-sm font-medium text-slate-800">{result.Methodology_Used}</div>
          {result.Allocation_Detail && (
            <div className="text-xs text-slate-500">Allocation: {result.Allocation_Detail.method} · {result.Allocation_Detail.share}</div>
          )}
          <div className="text-xs text-slate-500 italic">{result.Transparency_Note}</div>
        </div>

        {/* Cat 12 – End of Life Australian */}
        {cat12 && (
          <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-blue-900">Cat 12 – End-of-Life Analysis (Australian NGA)</h4>
              <span className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full">{cat12.region || "Australia"}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                <div className="text-xs text-slate-500">Footprint</div>
                <div className="text-lg font-bold text-red-600">{cat12.total_cat12_kgCO2e}</div>
                <div className="text-xs text-slate-400">kgCO₂e</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                <div className="text-xs text-slate-500">Circularity Credit</div>
                <div className="text-lg font-bold text-emerald-600">-{cat12.avoided_carbon_kgCO2e}</div>
                <div className="text-xs text-slate-400">kgCO₂e saved</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                <div className="text-xs text-slate-500">Net EoL Impact</div>
                <div className={`text-lg font-bold ${cat12.net_eol_kgCO2e < 0 ? "text-emerald-600" : "text-amber-600"}`}>{cat12.net_eol_kgCO2e}</div>
                <div className="text-xs text-slate-400">kgCO₂e net</div>
              </div>
            </div>
            {cat12.material_breakdown && (
              <button onClick={() => setShowDetails(!showDetails)} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showDetails ? "Hide" : "Show"} material breakdown
              </button>
            )}
            {showDetails && cat12.material_breakdown && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-blue-100">
                    {["Material","Weight","Recycled","Recovery %","Footprint","Avoided"].map(h => (
                      <th key={h} className="text-left py-1.5 px-2 font-semibold text-blue-700">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {cat12.material_breakdown.map(m => (
                      <tr key={m.material} className="border-b border-blue-50">
                        <td className="py-1.5 px-2 font-medium">{m.material}</td>
                        <td className="py-1.5 px-2">{m.weight_kg}kg</td>
                        <td className="py-1.5 px-2">{m.recycled_kg}kg</td>
                        <td className="py-1.5 px-2">{m.recovery_rate_pct}%</td>
                        <td className="py-1.5 px-2 text-red-600">{(m.landfill_emissions_kgCO2e + m.recycling_emissions_kgCO2e + m.efw_emissions_kgCO2e + m.transport_emissions_kgCO2e).toFixed(3)}</td>
                        <td className="py-1.5 px-2 text-emerald-600">-{m.avoided_carbon_kgCO2e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-xs text-blue-500 italic">Source: {cat12.data_source}</div>
          </div>
        )}

        {/* Flags */}
        {result.Flags?.length > 0 && (
          <div className="space-y-2">
            {result.Flags.map((f, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">{f}</div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {result.Recommendations?.length > 0 && (
          <div className="space-y-2">
            {result.Recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm text-emerald-800">{r}</div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save to Emission Records"}
        </Button>
      </div>
    </div>
  );
}

export default function Scope3Calculator() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", supplier_name: "", item_type: "Consumable / Raw Material",
    quantity: "", unit: "units", total_weight_kg: "", purchase_value_usd: "",
    currency: "USD", sector_code: "", transport_responsible: "Supplier Paid (Bundled)",
    transport_distance_km: "", transport_mode: "Road",
    data_tier: "Tier 4 – Spend-Based Only",
    epd_factor_kgco2e_per_unit: "",
    supplier_scope1_kgco2e: "", supplier_scope2_kgco2e: "",
    supplier_total_output_kg: "", supplier_total_revenue_usd: "",
    supplier_machine_hours_total: "", product_machine_hours: "",
    allocation_method: "Mass-Based",
    bom: [],
    client_region: "Victoria", location_type: "Metro",
    reporting_year: 2024, notes: "",
  });
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entryId, setEntryId] = useState(null);
  const [bomItem, setBomItem] = useState({ material: "Steel", weight_kg: "", scrap_rate_pct: "5" });

  const load = () => base44.entities.PurchaseEntry.list("-created_date", 20).then(d => { setEntries(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addBomItem = () => {
    if (!bomItem.weight_kg) return;
    setForm(f => ({ ...f, bom: [...f.bom, { ...bomItem, weight_kg: parseFloat(bomItem.weight_kg), scrap_rate_pct: parseFloat(bomItem.scrap_rate_pct) || 5 }] }));
    setBomItem({ material: "Steel", weight_kg: "", scrap_rate_pct: "5" });
  };

  const removeBomItem = (i) => setForm(f => ({ ...f, bom: f.bom.filter((_, idx) => idx !== i) }));

  const calculate = async () => {
    setCalculating(true);
    setResult(null);
    // Save draft entry first
    const entry = await base44.entities.PurchaseEntry.create({
      ...form,
      quantity: parseFloat(form.quantity) || undefined,
      total_weight_kg: parseFloat(form.total_weight_kg) || undefined,
      purchase_value_usd: parseFloat(form.purchase_value_usd) || undefined,
      status: "Draft",
    });
    setEntryId(entry.id);

    const res = await base44.functions.invoke("calculateScope3", { ...form, purchase_entry_id: entry.id });
    setResult(res.data.result);
    setCalculating(false);
    load();
  };

  const saveToEmissions = async () => {
    if (!result || !entryId) return;
    setSaving(true);
    // Save each category as an EmissionEntry
    for (const [cat, val] of Object.entries(result.Category_Split)) {
      await base44.entities.EmissionEntry.create({
        scope: "Scope 3",
        category: cat,
        source_name: form.name,
        supplier: form.supplier_name,
        tco2e: val / 1000,
        quantity: parseFloat(form.quantity) || undefined,
        unit: form.unit,
        amount_paid: parseFloat(form.purchase_value_usd) || undefined,
        currency: form.currency,
        calculation_method: result.Methodology_Used?.includes("Spend") ? "Spend-Based" : "Actual",
        notes: `Data Quality: ${result.Data_Quality_Score}/10 | ${result.Methodology_Used}`,
        reporting_year: parseInt(form.reporting_year) || 2024,
        status: "Draft",
      });
    }
    setSaving(false);
    alert("Saved to Scope 3 emission records.");
  };

  const tierClass = TIER_COLORS[form.data_tier] || "";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Scope 3 Emissions Calculator</h1>
        <p className="text-sm text-slate-500 mt-0.5">GHG Protocol · ISO 14064 · Australian NGA Factors for End-of-Life</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── LEFT: Input Form ── */}
        <div className="space-y-5">

          {/* Phase 1: Classification */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">1</div>
              <h2 className="font-semibold text-slate-800">Classification & Boundary</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-sm">Product / Service Name *</Label>
                  <Input className="mt-1" placeholder="e.g. Steel Beams" value={form.name} onChange={e => set("name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Supplier</Label>
                  <Input className="mt-1" placeholder="Supplier name" value={form.supplier_name} onChange={e => set("supplier_name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Item Type *</Label>
                  <Select value={form.item_type} onValueChange={v => set("item_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Quantity</Label>
                  <Input className="mt-1" type="number" placeholder="500" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Unit</Label>
                  <Input className="mt-1" placeholder="units / kg / m³" value={form.unit} onChange={e => set("unit", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Total Weight (kg)</Label>
                  <Input className="mt-1" type="number" placeholder="2000" value={form.total_weight_kg} onChange={e => set("total_weight_kg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Purchase Value (USD)</Label>
                  <Input className="mt-1" type="number" placeholder="5000" value={form.purchase_value_usd} onChange={e => set("purchase_value_usd", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm">Industry / Sector</Label>
                  <Select value={form.sector_code} onValueChange={v => set("sector_code", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select sector..." /></SelectTrigger>
                    <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Transport logic */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">Transport Boundary (Who Drives the Truck?)</span>
                </div>
                <Select value={form.transport_responsible} onValueChange={v => set("transport_responsible", v)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supplier Paid (Bundled)">Supplier Paid — bundle into Cat 1/2</SelectItem>
                    <SelectItem value="Client Paid / Ex-Works">Client Paid / Ex-Works — separate Cat 4</SelectItem>
                  </SelectContent>
                </Select>
                {form.transport_responsible === "Client Paid / Ex-Works" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Distance (km)</Label>
                      <Input className="mt-1 h-8 text-sm" type="number" placeholder="500" value={form.transport_distance_km} onChange={e => set("transport_distance_km", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Mode</Label>
                      <Select value={form.transport_mode} onValueChange={v => set("transport_mode", v)}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Road","Rail","Sea","Air","Mixed"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Phase 2: Data Quality Tier */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">2</div>
              <h2 className="font-semibold text-slate-800">Data Quality Hierarchy</h2>
            </div>
            <div className="space-y-3">
              <Select value={form.data_tier} onValueChange={v => set("data_tier", v)}>
                <SelectTrigger className={`text-sm border ${tierClass}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATA_TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Tier 1 */}
              {form.data_tier.startsWith("Tier 1") && (
                <div>
                  <Label className="text-sm">EPD Factor (kgCO₂e per unit)</Label>
                  <Input className="mt-1" type="number" placeholder="2.1" value={form.epd_factor_kgco2e_per_unit} onChange={e => set("epd_factor_kgco2e_per_unit", e.target.value)} />
                </div>
              )}

              {/* Tier 2 */}
              {form.data_tier.startsWith("Tier 2") && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Supplier Scope 1 (kgCO₂e)</Label>
                      <Input className="mt-1 h-8 text-sm" type="number" placeholder="50000" value={form.supplier_scope1_kgco2e} onChange={e => set("supplier_scope1_kgco2e", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Supplier Scope 2 (kgCO₂e)</Label>
                      <Input className="mt-1 h-8 text-sm" type="number" placeholder="20000" value={form.supplier_scope2_kgco2e} onChange={e => set("supplier_scope2_kgco2e", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Allocation Method</Label>
                    <Select value={form.allocation_method} onValueChange={v => set("allocation_method", v)}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Mass-Based","Machine Hours","Economic","Industry Estimate"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.allocation_method === "Mass-Based" && (
                    <div>
                      <Label className="text-xs">Supplier Total Factory Output (kg)</Label>
                      <Input className="mt-1 h-8 text-sm" type="number" placeholder="1000000" value={form.supplier_total_output_kg} onChange={e => set("supplier_total_output_kg", e.target.value)} />
                    </div>
                  )}
                  {form.allocation_method === "Machine Hours" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Total Factory Machine Hours</Label>
                        <Input className="mt-1 h-8 text-sm" type="number" value={form.supplier_machine_hours_total} onChange={e => set("supplier_machine_hours_total", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Hours for This Product</Label>
                        <Input className="mt-1 h-8 text-sm" type="number" value={form.product_machine_hours} onChange={e => set("product_machine_hours", e.target.value)} />
                      </div>
                    </div>
                  )}
                  {form.allocation_method === "Economic" && (
                    <div>
                      <Label className="text-xs">Supplier Total Revenue (USD)</Label>
                      <Input className="mt-1 h-8 text-sm" type="number" value={form.supplier_total_revenue_usd} onChange={e => set("supplier_total_revenue_usd", e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Phase 3: BOM */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">3</div>
              <h2 className="font-semibold text-slate-800">Bill of Materials (BOM)</h2>
              <span className="text-xs text-slate-400">— for Cat 5 & Cat 12 calculations</span>
            </div>
            <div className="flex gap-2 mb-3">
              <Select value={bomItem.material} onValueChange={v => setBomItem(b => ({ ...b, material: v }))}>
                <SelectTrigger className="text-sm flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="w-24 text-sm" type="number" placeholder="kg" value={bomItem.weight_kg} onChange={e => setBomItem(b => ({ ...b, weight_kg: e.target.value }))} />
              <Input className="w-20 text-sm" type="number" placeholder="scrap%" value={bomItem.scrap_rate_pct} onChange={e => setBomItem(b => ({ ...b, scrap_rate_pct: e.target.value }))} />
              <Button size="sm" variant="outline" onClick={addBomItem}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.bom.length > 0 ? (
              <div className="space-y-1">
                {form.bom.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-slate-700">{item.material}</span>
                    <span className="text-slate-500">{item.weight_kg} kg · {item.scrap_rate_pct}% scrap</span>
                    <button onClick={() => removeBomItem(i)} className="text-slate-400 hover:text-red-500 transition-colors ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">Add BOM items to unlock Cat 5 & Cat 12 calculations</div>
            )}
          </div>

          {/* Phase 4: End-of-Life Region */}
          {form.bom.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">4</div>
                <h2 className="font-semibold text-slate-800">End-of-Life Region (Australian NGA)</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Client State / Region</Label>
                  <Select value={form.client_region} onValueChange={v => set("client_region", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Victoria","NSW","Queensland","WA","SA","Tasmania","ACT","NT","Other"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Location Type</Label>
                  <Select value={form.location_type} onValueChange={v => set("location_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Metro">Metro (50km default)</SelectItem>
                      <SelectItem value="Regional">Regional (200km default)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <Button className="w-full h-12 text-base gap-2" onClick={calculate} disabled={calculating || !form.name}>
            <Calculator className="w-5 h-5" />
            {calculating ? "Calculating..." : "Calculate Scope 3 Emissions"}
          </Button>
        </div>

        {/* ── RIGHT: Results ── */}
        <div className="space-y-5">
          {result ? (
            <ResultPanel result={result} onSave={saveToEmissions} saving={saving} />
          ) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-center px-6">
              <Calculator className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">Results will appear here</h3>
              <p className="text-sm text-slate-400">Fill in the form and click Calculate to run the GHG Protocol analysis with Australian NGA End-of-Life factors.</p>
            </div>
          )}

          {/* Recent calculations */}
          {entries.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent Calculations</h3>
              <div className="space-y-2">
                {entries.slice(0, 8).map(e => {
                  let parsed = null;
                  try { parsed = e.result_json ? JSON.parse(e.result_json) : null; } catch {}
                  return (
                    <div key={e.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <div className="font-medium text-slate-800">{e.name}</div>
                        <div className="text-xs text-slate-400">{e.supplier_name} · {e.data_tier?.split(" – ")[0]}</div>
                      </div>
                      <div className="text-right">
                        {parsed ? (
                          <>
                            <div className="font-bold text-slate-900">{parsed.Total_Emissions_kgCO2e} kg</div>
                            <DataQualityBadge score={parsed.Data_Quality_Score} />
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">{e.status}</span>
                        )}
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