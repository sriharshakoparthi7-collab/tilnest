import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateEquipmentEmissions, UNIT_FOR_MEASUREMENT } from "@/utils/equipmentHelpers";

const EQUIPMENT_TYPES = ["Generator","Compressor","Forklift","Pump","Welder","Excavator","Loader","Grinder","Air Handler","Boiler","Chiller","Fan","Motor","Other"];
const POWER_SOURCES = ["Petrol","Diesel","Natural Gas","LPG","CNG","Electric","Hybrid","Other"];
const ACTIVITY_TYPES = ["Continuous","Intermittent","Standby","Seasonal"];
const MEASUREMENT_TYPES = ["Operating Hours","Fuel Consumption (L)","Energy Consumption (kWh)","Load Factor (%)"];

const BLANK = {
  equipment_name: "", equipment_type: "Generator", equipment_subtype: "",
  serial_number: "", location_id: "", location_name: "",
  power_source: "Diesel", activity_type: "Continuous",
  measurement_type: "Fuel Consumption (L)", quantity: "",
  start_date: "", end_date: "", reporting_period: "Monthly",
  manufacturer: "", model: "", equipment_age_years: "",
  status: "Active", notes: "",
};

export default function EquipmentForm({ open, onClose, onSaved, defaultValues = {} }) {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ ...BLANK, ...defaultValues });
  const [saving, setSaving] = useState(false);

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);
  useEffect(() => { if (open) setForm({ ...BLANK, ...defaultValues }); }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const autoUnit = UNIT_FOR_MEASUREMENT[form.measurement_type] || "units";
  const { tco2e, method } = calculateEquipmentEmissions(form);

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const data = {
      ...form,
      location_name: loc?.name || form.location_name,
      unit: autoUnit,
      quantity: parseFloat(form.quantity) || 0,
      equipment_age_years: parseFloat(form.equipment_age_years) || undefined,
      tco2e: parseFloat(tco2e.toFixed(6)),
      calculation_method: method,
    };
    if (defaultValues.id) await base44.entities.Equipment.update(defaultValues.id, data);
    else await base44.entities.Equipment.create(data);
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{defaultValues.id ? "Edit Equipment" : "Add Equipment"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Track stationary & mobile machinery emissions</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Identification */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identification</div>
            <div>
              <Label className="text-sm font-medium">Equipment Name / ID *</Label>
              <Input className="mt-1" placeholder="e.g. Generator-A, Compressor-01" value={form.equipment_name} onChange={e => set("equipment_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Equipment Type *</Label>
                <Select value={form.equipment_type} onValueChange={v => set("equipment_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Subtype (optional)</Label>
                <Input className="mt-1" placeholder="e.g. Diesel Generator 50kW" value={form.equipment_subtype} onChange={e => set("equipment_subtype", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Location & Power */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location & Power</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Location</Label>
                <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Power / Fuel Source *</Label>
                <Select value={form.power_source} onValueChange={v => set("power_source", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{POWER_SOURCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {form.power_source !== "Electric" && (
              <div>
                <Label className="text-sm font-medium">Serial Number (optional)</Label>
                <Input className="mt-1" placeholder="e.g. SN-2394821" value={form.serial_number} onChange={e => set("serial_number", e.target.value)} />
              </div>
            )}
          </div>

          {/* Activity & Usage */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activity & Usage</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Activity Pattern *</Label>
                <Select value={form.activity_type} onValueChange={v => set("activity_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIVITY_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Reporting Period</Label>
                <Select value={form.reporting_period} onValueChange={v => set("reporting_period", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Weekly","Monthly","Quarterly","Annually"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">How do you measure activity? *</Label>
              <div className="mt-2 space-y-1.5">
                {MEASUREMENT_TYPES.map(mt => (
                  <label key={mt} className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all ${form.measurement_type === mt ? "bg-blue-50 border-blue-300" : "border-transparent hover:bg-slate-50"}`}>
                    <input type="radio" name="measurement_type" checked={form.measurement_type === mt} onChange={() => set("measurement_type", mt)} className="accent-blue-600" />
                    <span className="text-sm text-slate-800">{mt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Quantity * <span className="text-slate-400 font-normal">({autoUnit})</span></Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Period Start *</Label>
                <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Period End</Label>
                <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Specifications (optional)</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-medium">Manufacturer</Label>
                <Input className="mt-1" placeholder="e.g. Caterpillar" value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Model</Label>
                <Input className="mt-1" placeholder="e.g. C9" value={form.model} onChange={e => set("model", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Age (years)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.equipment_age_years} onChange={e => set("equipment_age_years", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Metadata</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Active","Inactive","Retired"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <Input className="mt-1" placeholder="Additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>

          {/* Emissions Preview */}
          {parseFloat(form.quantity) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs text-emerald-600 font-medium mb-0.5">Estimated Emissions</div>
              <div className="text-2xl font-bold text-emerald-800">{tco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
              <div className="text-xs text-emerald-600/70 mt-0.5">{method}</div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.equipment_name || !form.quantity}>
            {saving ? "Saving..." : "Save Equipment"}
          </Button>
        </div>
      </div>
    </div>
  );
}