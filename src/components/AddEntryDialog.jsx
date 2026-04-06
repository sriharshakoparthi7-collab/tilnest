import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Simplified emission factors (kg CO2e per unit)
const EMISSION_FACTORS = {
  "Electricity (kWh)": 0.233,
  "Natural Gas (m³)": 2.04,
  "Diesel (L)": 2.68,
  "Petrol (L)": 2.31,
  "LPG (L)": 1.51,
};

export default function AddEntryDialog({ open, onClose, onSaved, scope, category, subCategory, defaultValues = {} }) {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    source_name: "", location_id: "", location_name: "", supplier: "",
    start_date: "", end_date: "", quantity: "", unit: "kWh",
    amount_paid: "", currency: "USD", green_power_pct: "",
    calculation_method: "Actual", notes: "", status: "Draft",
    fuel_type: "", vehicle_type: "", ...defaultValues
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const calcEmissions = () => {
    const factor = EMISSION_FACTORS[`${form.fuel_type || "Electricity"} (${form.unit})`] || 0.233;
    return ((parseFloat(form.quantity) || 0) * factor) / 1000;
  };

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const tco2e = calcEmissions();
    const data = {
      ...form,
      scope, category,
      sub_category: subCategory,
      location_name: loc?.name || form.location_name,
      reporting_year: 2024,
      quantity: parseFloat(form.quantity) || undefined,
      amount_paid: parseFloat(form.amount_paid) || undefined,
      green_power_pct: parseFloat(form.green_power_pct) || undefined,
      tco2e: parseFloat(tco2e.toFixed(6)),
    };
    if (defaultValues.id) await base44.entities.EmissionEntry.update(defaultValues.id, data);
    else await base44.entities.EmissionEntry.create(data);
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  const estimatedTCO2e = calcEmissions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-semibold">{defaultValues.id ? "Edit Entry" : "Add Emission Data"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{scope} · {category}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium">Source / Asset Name</Label>
            <Input className="mt-1" placeholder="e.g. Main Office Electricity" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Location</Label>
              <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Supplier</Label>
              <Input className="mt-1" placeholder="Supplier name" value={form.supplier} onChange={e => set("supplier", e.target.value)} />
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
              <Label className="text-sm font-medium">Quantity</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Unit</Label>
              <Select value={form.unit} onValueChange={v => set("unit", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["kWh", "MWh", "GJ", "L", "m³", "t", "kg", "km", "miles"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Amount Paid</Label>
              <Input type="number" className="mt-1" placeholder="0.00" value={form.amount_paid} onChange={e => set("amount_paid", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Currency</Label>
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "AUD", "SGD", "INR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {scope === "Scope 2" && (
            <div>
              <Label className="text-sm font-medium">Green Power %</Label>
              <Input type="number" className="mt-1" placeholder="0" min="0" max="100" value={form.green_power_pct} onChange={e => set("green_power_pct", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Percentage of electricity from renewable sources</p>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Calculation Method</Label>
            <Select value={form.calculation_method} onValueChange={v => set("calculation_method", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Actual", "Estimate", "Spend-Based", "Distance-Based"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input className="mt-1" placeholder="Any additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Estimated Emissions Preview */}
          {parseFloat(form.quantity) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs text-emerald-600 font-medium mb-0.5">Estimated Emissions</div>
              <div className="text-2xl font-bold text-emerald-800">{estimatedTCO2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
              <div className="text-xs text-emerald-600/70 mt-0.5">Based on default emission factors</div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}