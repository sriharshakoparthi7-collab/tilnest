import { useState, useEffect } from "react";
import { X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const AUS_GRID = 0.79;
const WASTE_FACTORS = { "Landfill": 1.91, "Recycling": 0.04, "Incineration": 0.56, "Composting": 0.19 };
const REFRIGERANT_GWP = { "R-410A": 2088, "R-134a": 1430, "R-32": 675, "R-22": 1810, "CO2": 1 };

export default function SoldProductsDialog({ open, onClose, onSaved, triggeredCategories = [] }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const [form, setForm] = useState({
    product_name: "", location_id: "", start_date: "", end_date: "",
    units_sold: "", product_weight_kg: "",
    // Cat 10
    processing_ef: "", processing_energy_kwh: "",
    // Cat 11
    use_phase_years: "", annual_energy_kwh: "", annual_fuel_litres: "",
    gwp_gas_type: "R-410A", gwp_leakage_kg: "",
    indirect_energy_kwh_lifetime: "",
    // Cat 12
    eol_waste_kg: "", eol_disposal_method: "Landfill",
    notes: "", status: "Draft"
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const hasCat10 = triggeredCategories.some(c => c.category?.includes("Processing"));
  const hasCat11 = triggeredCategories.some(c => c.category?.includes("Use"));
  const hasCat12 = triggeredCategories.some(c => c.category?.includes("End-of-Life"));

  const units = parseFloat(form.units_sold) || 0;
  const years = parseFloat(form.use_phase_years) || 0;

  // Cat 10 calc
  const cat10 = hasCat10 ? units * (parseFloat(form.processing_energy_kwh) || 0) * AUS_GRID / 1000 : 0;

  // Cat 11 calc (direct energy)
  const cat11_direct = units * years * ((parseFloat(form.annual_energy_kwh) || 0) * AUS_GRID / 1000);
  const cat11_fuel = units * years * ((parseFloat(form.annual_fuel_litres) || 0) * 2.68 / 1000);
  const cat11_gwp = form.gwp_leakage_kg ? units * years * (parseFloat(form.gwp_leakage_kg) || 0) * (REFRIGERANT_GWP[form.gwp_gas_type] || 2088) / 1000 : 0;
  const cat11_indirect = units * (parseFloat(form.indirect_energy_kwh_lifetime) || 0) * AUS_GRID / 1000;
  const cat11 = hasCat11 ? cat11_direct + cat11_fuel + cat11_gwp + cat11_indirect : 0;

  // Cat 12 calc
  const cat12 = hasCat12 ? units * (parseFloat(form.eol_waste_kg) || 0) * (WASTE_FACTORS[form.eol_disposal_method] || 1.91) / 1000 : 0;

  const totalTco2e = cat10 + cat11 + cat12;

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const base = {
      scope: "Scope 3", location_id: form.location_id, location_name: loc?.name || "",
      source_name: form.product_name, start_date: form.start_date, end_date: form.end_date,
      units_sold: units, product_weight_kg: parseFloat(form.product_weight_kg) || undefined,
      use_phase_years: years, notes: form.notes, status: form.status,
      reporting_year: 2024,
    };

    const saves = [];
    if (hasCat10 && cat10 > 0) saves.push(base44.entities.EmissionEntry.create({ ...base, category: "Processing of Sold Products", s3_category_number: 10, tco2e: parseFloat(cat10.toFixed(6)), cat10_tco2e: parseFloat(cat10.toFixed(6)), calculation_method: "Actual", data_quality_tier: "tier2" }));
    if (hasCat11 && cat11 > 0) saves.push(base44.entities.EmissionEntry.create({ ...base, category: "Use of Sold Products", s3_category_number: 11, tco2e: parseFloat(cat11.toFixed(6)), cat11_tco2e: parseFloat(cat11.toFixed(6)), annual_energy_kwh: parseFloat(form.annual_energy_kwh) || undefined, calculation_method: "Actual", data_quality_tier: "tier2" }));
    if (hasCat12 && cat12 > 0) saves.push(base44.entities.EmissionEntry.create({ ...base, category: "End-of-Life Treatment of Sold Products", s3_category_number: 12, tco2e: parseFloat(cat12.toFixed(6)), cat12_tco2e: parseFloat(cat12.toFixed(6)), eol_waste_kg: parseFloat(form.eol_waste_kg) || undefined, eol_disposal_method: form.eol_disposal_method, calculation_method: "Actual", data_quality_tier: "tier2" }));

    await Promise.all(saves);
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
            <h2 className="text-lg font-bold text-slate-900">Add Sold Product Emissions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Categories: {triggeredCategories.map(c => c.label).join(" · ")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Common */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Product Name</Label>
              <Input className="mt-1" placeholder="e.g. Refrigerator Model X" value={form.product_name} onChange={e => set("product_name", e.target.value)} />
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
              <Label className="text-sm font-medium">Start Date</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">End Date</Label>
              <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Units Sold</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.units_sold} onChange={e => set("units_sold", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Product Weight / Unit (kg)</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.product_weight_kg} onChange={e => set("product_weight_kg", e.target.value)} />
            </div>
          </div>

          {/* Cat 10 */}
          {hasCat10 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-blue-800 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Category 10 — Processing of Sold Products</div>
              <p className="text-xs text-blue-700">Emissions from industrial processing by the next company in the value chain (e.g., your ingredient used in their manufacturing line).</p>
              <div>
                <Label className="text-sm font-medium">Energy used to process each unit (kWh / unit)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.processing_energy_kwh} onChange={e => set("processing_energy_kwh", e.target.value)} />
              </div>
              {parseFloat(form.processing_energy_kwh) > 0 && units > 0 && (
                <div className="text-xs text-blue-800 font-semibold">Cat 10 = {cat10.toFixed(4)} tCO₂e</div>
              )}
            </div>
          )}

          {/* Cat 11 */}
          {hasCat11 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-purple-800 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Category 11 — Use of Sold Products</div>
              <p className="text-xs text-purple-700">Emissions during the customer's use of the product over its lifetime.</p>
              <div>
                <Label className="text-sm font-medium">Expected Product Lifespan (years)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.use_phase_years} onChange={e => set("use_phase_years", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Annual electricity per unit (kWh/yr)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.annual_energy_kwh} onChange={e => set("annual_energy_kwh", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Annual fuel per unit (litres/yr)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.annual_fuel_litres} onChange={e => set("annual_fuel_litres", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Refrigerant leakage / unit / yr (kg)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.gwp_leakage_kg} onChange={e => set("gwp_leakage_kg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Refrigerant Gas Type</Label>
                  <Select value={form.gwp_gas_type} onValueChange={v => set("gwp_gas_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(REFRIGERANT_GWP).map(([k, v]) => <SelectItem key={k} value={k}>{k} (GWP {v})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Indirect lifetime energy per unit (kWh total)</Label>
                <Input type="number" className="mt-1" placeholder="e.g. washing machine heating water over lifetime" value={form.indirect_energy_kwh_lifetime} onChange={e => set("indirect_energy_kwh_lifetime", e.target.value)} />
              </div>
              {cat11 > 0 && <div className="text-xs text-purple-800 font-semibold">Cat 11 = {cat11.toFixed(4)} tCO₂e (direct: {(cat11_direct + cat11_fuel).toFixed(4)} + GWP: {cat11_gwp.toFixed(4)} + indirect: {cat11_indirect.toFixed(4)})</div>}
            </div>
          )}

          {/* Cat 12 */}
          {hasCat12 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-orange-800 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Category 12 — End-of-Life Treatment</div>
              <p className="text-xs text-orange-700">Emissions from the disposal or recycling of the product at end of life.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Waste weight / unit (kg)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.eol_waste_kg} onChange={e => set("eol_waste_kg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Disposal Method</Label>
                  <Select value={form.eol_disposal_method} onValueChange={v => set("eol_disposal_method", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(WASTE_FACTORS).map(([k, v]) => <SelectItem key={k} value={k}>{k} ({v} kg/kg)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {cat12 > 0 && <div className="text-xs text-orange-800 font-semibold">Cat 12 = {cat12.toFixed(4)} tCO₂e</div>}
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <Input className="mt-1" placeholder="Additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Summary */}
          {totalTco2e > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs text-emerald-600 font-medium mb-1">Total Calculated Emissions</div>
              <div className="text-2xl font-bold text-emerald-800">{totalTco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
              <div className="text-xs text-emerald-700 mt-1 space-y-0.5">
                {hasCat10 && <div className="flex justify-between"><span>Cat 10 (Processing)</span><span className="font-semibold">{cat10.toFixed(4)} tCO₂e</span></div>}
                {hasCat11 && <div className="flex justify-between"><span>Cat 11 (Use Phase)</span><span className="font-semibold">{cat11.toFixed(4)} tCO₂e</span></div>}
                {hasCat12 && <div className="flex justify-between"><span>Cat 12 (End-of-Life)</span><span className="font-semibold">{cat12.toFixed(4)} tCO₂e</span></div>}
              </div>
              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600 mt-2">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="mt-2 bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  <div><span className="font-semibold">Cat 10:</span> {units} units × {form.processing_energy_kwh} kWh × {AUS_GRID} kgCO₂e/kWh ÷ 1000</div>
                  <div><span className="font-semibold">Cat 11 direct:</span> {units} units × {years} yrs × ({form.annual_energy_kwh} kWh × {AUS_GRID} + {form.annual_fuel_litres} L × 2.68) ÷ 1000</div>
                  <div><span className="font-semibold">Cat 12:</span> {units} units × {form.eol_waste_kg} kg × {WASTE_FACTORS[form.eol_disposal_method]} kg/kg ÷ 1000</div>
                  <div className="text-slate-400 mt-1">Databases: GHG Protocol Scope 3 Std · AUS NGA 2024 · IPCC AR6</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || units === 0}>
            {saving ? "Saving..." : `Save ${[hasCat10, hasCat11, hasCat12].filter(Boolean).length} Entries`}
          </Button>
        </div>
      </div>
    </div>
  );
}