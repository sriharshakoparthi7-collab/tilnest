import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { calculateEquipmentEmissions, unitForMeasurementType, EQUIPMENT_TYPES, POWER_SOURCES, ACTIVITY_TYPES, MEASUREMENT_TYPES } from "@/utils/equipmentHelpers";

const BLANK = {
  equipment_name: "", equipment_type_main: "Generator", equipment_subtype: "",
  location_id: "", power_source: "Diesel", activity_type: "Intermittent (scheduled use)",
  measurement_type: "Fuel Consumption (L)", quantity: "", unit: "L",
  start_date: "", end_date: "", reporting_period: "Monthly",
  manufacturer: "", model: "", serial_number: "", equipment_age_years: "",
  status: "Active", notes: "", tags: [],
};

export default function EquipmentForm({ open, onClose, onSaved, defaultValues }) {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);
  useEffect(() => {
    if (open) setForm({ ...BLANK, ...defaultValues });
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleMeasurementChange = (v) => {
    set("measurement_type", v);
    set("unit", unitForMeasurementType(v));
  };

  const preview = calculateEquipmentEmissions({
    measurementType: form.measurement_type,
    quantity: form.quantity,
    powerSource: form.power_source,
    equipmentType: form.equipment_type_main,
  });

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const data = {
      ...form,
      location_name: loc?.name || "",
      quantity: parseFloat(form.quantity) || 0,
      equipment_age_years: parseFloat(form.equipment_age_years) || undefined,
      tco2e: preview.tco2e,
      calculation_method: preview.method,
    };
    if (defaultValues?.id) await base44.entities.Equipment.update(defaultValues.id, data);
    else await base44.entities.Equipment.create(data);
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">{defaultValues?.id ? "Edit Equipment" : "Add Equipment"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Identification */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Identification</div>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Equipment Name / ID <span className="text-red-500">*</span></Label>
                <Input className="mt-1" placeholder="e.g. Generator-A, Compressor-01" value={form.equipment_name} onChange={e => set("equipment_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Equipment Type <span className="text-red-500">*</span></Label>
                  <Select value={form.equipment_type_main} onValueChange={v => set("equipment_type_main", v)}>
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
          </div>

          {/* Location & Power */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Location & Power</div>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Location <span className="text-red-500">*</span></Label>
                <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select location..." /></SelectTrigger>
                  <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Power / Fuel Source <span className="text-red-500">*</span></Label>
                  <Select value={form.power_source} onValueChange={v => set("power_source", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{POWER_SOURCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.power_source !== "Electric" && (
                  <div>
                    <Label className="text-sm font-medium">Serial Number</Label>
                    <Input className="mt-1" placeholder="Optional" value={form.serial_number} onChange={e => set("serial_number", e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity & Usage */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Activity & Usage</div>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Primary Activity Pattern <span className="text-red-500">*</span></Label>
                <Select value={form.activity_type} onValueChange={v => set("activity_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIVITY_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">How do you measure activity? <span className="text-red-500">*</span></Label>
                <div className="mt-2 space-y-2">
                  {MEASUREMENT_TYPES.map(m => (
                    <label key={m} className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all ${form.measurement_type === m ? "bg-emerald-50 border-emerald-300" : "border-transparent hover:bg-slate-50"}`}>
                      <input type="radio" name="measurement_type" checked={form.measurement_type === m} onChange={() => handleMeasurementChange(m)} className="accent-emerald-600" />
                      <span className="text-sm text-slate-700">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Quantity <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="number" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                    <span className="flex items-center text-sm text-slate-500 px-2 bg-slate-50 border border-slate-200 rounded-md whitespace-nowrap">{unitForMeasurementType(form.measurement_type)}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Reporting Period</Label>
                  <Select value={form.reporting_period} onValueChange={v => set("reporting_period", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Weekly","Monthly","Quarterly","Annually"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Start Date <span className="text-red-500">*</span></Label>
                  <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date</Label>
                  <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Specifications (Optional)</div>
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
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Metadata</div>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Active","Inactive","Retired"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Notes</Label>
                <Input className="mt-1" placeholder="Additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Emissions Preview */}
          {parseFloat(form.quantity) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs text-emerald-600 font-medium">Estimated Emissions</div>
              <div className="text-2xl font-bold text-emerald-800 mt-0.5">{preview.tco2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
              <div className="text-xs text-emerald-600/70 mt-1">{preview.method}</div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.equipment_name || !form.location_id || !form.quantity || !form.start_date}>
            {saving ? "Saving..." : "Save Equipment"}
          </Button>
        </div>
      </div>
    </div>
  );
}