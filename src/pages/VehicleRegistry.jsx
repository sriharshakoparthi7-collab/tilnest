import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Car, Trash2, Edit2, X, Search, Upload, Activity } from "lucide-react";
import VehicleEmissionsDialog from "../components/VehicleEmissionsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationSelector from "../components/LocationSelector";
import BulkUploadModal from "../components/BulkUploadModal";

const VEHICLE_TYPES = ["Car-Average", "Van-Average", "Heavy Goods Vehicle (Truck)-Average", "Motorbike-Average", "Bus", "Other"];
const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "CNG", "LPG", "Electric", "Other"];
const STATUS_OPTS = ["Active", "Inactive"];
const USAGE_TYPES = ["Distance (km)", "Fuel Consumption (L)"];

// kg CO2e per km (distance) or per L (fuel)
const EF_DISTANCE = { "Petrol": 0.170, "Diesel": 0.190, "Hybrid": 0.110, "CNG": 0.140, "LPG": 0.160, "Electric": 0.064, "Other": 0.170 };
const EF_FUEL = { "Petrol": 2.31, "Diesel": 2.68, "Hybrid": 2.00, "CNG": 2.04, "LPG": 1.51, "Electric": 0.0, "Other": 2.00 };

const TEMPLATE_HEADERS = ["name", "license_plate", "vin", "vehicle_type", "fuel_type", "usage_type", "quantity", "start_date", "end_date", "location_name", "status", "notes"];
const EXAMPLE_ROWS = [
  ["Sales Car 1", "ABC123", "", "Car-Average", "Petrol", "Distance (km)", "25000", "2024-01-01", "2024-12-31", "Sydney HQ", "Active", ""],
  ["Delivery Van", "XYZ456", "", "Van-Average", "Diesel", "Fuel Consumption (L)", "3200", "2024-01-01", "2024-12-31", "Melbourne Warehouse", "Active", ""],
];

const FUEL_COLORS = {
  Electric: "bg-blue-50 text-blue-700", Hybrid: "bg-teal-50 text-teal-700",
  Petrol: "bg-amber-50 text-amber-700", Diesel: "bg-orange-50 text-orange-700",
  CNG: "bg-purple-50 text-purple-700", LPG: "bg-indigo-50 text-indigo-700",
  Other: "bg-slate-100 text-slate-500",
};

const emptyForm = { name: "", vin: "", license_plate: "", vehicle_type: "Car-Average", fuel_type: "Petrol", usage_type: "Distance (km)", quantity: "", start_date: "", end_date: "", location_id: "", location_name: "", status: "Active", notes: "" };

function calcEmissions(form) {
  const qty = parseFloat(form.quantity) || 0;
  if (!qty) return 0;
  if (form.usage_type === "Distance (km)") {
    return qty * (EF_DISTANCE[form.fuel_type] || 0.170) / 1000;
  }
  return qty * (EF_FUEL[form.fuel_type] || 2.31) / 1000;
}

export default function VehicleRegistry() {
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [fuelFilter, setFuelFilter] = useState("All");
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState(emptyForm);
  const [showEmissions, setShowEmissions] = useState(false);
  const [emissionsVehicle, setEmissionsVehicle] = useState(null);

  const load = async () => {
    const [vs, ls] = await Promise.all([base44.entities.Vehicle.list(), base44.entities.Location.list()]);
    setVehicles(vs); setLocations(ls); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...emptyForm, ...v }); setShowForm(true); };

  const save = async () => {
    const loc = locations.find(l => l.id === form.location_id);
    const tco2e = calcEmissions(form);
    const data = { ...form, location_name: loc?.name || form.location_name, quantity: parseFloat(form.quantity) || undefined, tco2e_estimate: parseFloat(tco2e.toFixed(6)) };
    if (editing) await base44.entities.Vehicle.update(editing.id, data);
    else await base44.entities.Vehicle.create(data);
    setShowForm(false); load();
  };

  const remove = async (id) => { await base44.entities.Vehicle.delete(id); load(); };

  const bulkDelete = async () => {
    await Promise.all([...selected].map(id => base44.entities.Vehicle.delete(id)));
    setSelected(new Set()); load();
  };

  const toggleSelect = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const handleBulkUpload = async (rows) => {
    let created = 0, skipped = 0;
    for (const row of rows) {
      if (!row.name) { skipped++; continue; }
      await base44.entities.Vehicle.create({ ...row, quantity: parseFloat(row.quantity) || undefined });
      created++;
    }
    load();
    return { created, skipped, errors: [] };
  };

  const filtered = vehicles.filter(v =>
    (typeFilter === "All" || v.vehicle_type === typeFilter) &&
    (fuelFilter === "All" || v.fuel_type === fuelFilter) &&
    (!search || (v.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.license_plate || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.location_name || "").toLowerCase().includes(search.toLowerCase()))
  );

  const totalTCO2e = filtered.reduce((s, v) => s + (parseFloat(v.tco2e_estimate) || 0), 0);

  const estimatedTCO2e = calcEmissions(form);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Vehicles</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track emissions from owned and controlled vehicles · Scope 1</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={bulkDelete} className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowBulk(true)} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Bulk Upload
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setEmissionsVehicle(null); setShowEmissions(true); }} className="gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Log Emissions
          </Button>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Vehicle
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Vehicles", value: vehicles.length },
          { label: "Active", value: vehicles.filter(v => v.status === "Active").length },
          { label: "Est. tCO₂e (filtered)", value: `${totalTCO2e.toFixed(3)} tCO₂e` },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-8 h-9 w-56 text-sm" placeholder="Search name, plate, location..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option value="All">All types</option>
          {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={fuelFilter} onChange={e => setFuelFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option value="All">All fuels</option>
          {FUEL_TYPES.map(f => <option key={f}>{f}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} vehicle{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
          <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">{search || typeFilter !== "All" || fuelFilter !== "All" ? "No vehicles match your filters" : "No vehicles registered"}</h3>
          <p className="text-sm text-slate-500 mb-4">Add your fleet to track Scope 1 mobile combustion emissions</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2"><Upload className="w-4 h-4" /> Bulk Upload</Button>
            <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add Vehicle</Button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="w-8 py-3 px-4"><input type="checkbox" className="accent-emerald-600" checked={selected.size === filtered.length && filtered.length > 0} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(v => v.id)) : new Set())} /></th>
                {["Name / ID", "Location", "Vehicle Type", "Fuel Type", "Usage", "Est. tCO₂e", "Status", ""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4"><input type="checkbox" className="accent-emerald-600" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} /></td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{v.name}</div>
                    {v.license_plate && <div className="text-xs text-slate-400 font-mono">{v.license_plate}</div>}
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{v.location_name || "—"}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{v.vehicle_type || "—"}</td>
                  <td className="py-3 px-4">
                    {v.fuel_type && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FUEL_COLORS[v.fuel_type] || ""}`}>{v.fuel_type}</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {v.quantity ? `${v.quantity} ${v.usage_type === "Distance (km)" ? "km" : "L"}` : "—"}
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-700 text-sm">
                    {v.tco2e_estimate ? `${parseFloat(v.tco2e_estimate).toFixed(3)}` : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{v.status || "Active"}</span>
                  </td>
                  <td className="py-3 px-4">
                   <div className="flex gap-1">
                     <button onClick={() => { setEmissionsVehicle(v); setShowEmissions(true); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600" title="Log Emissions"><Activity className="w-3.5 h-3.5" /></button>
                     <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                     <button onClick={() => remove(v.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                   </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between text-xs text-slate-500">
            <span>{filtered.length} vehicles</span>
            <span className="font-semibold text-slate-800">Total: {totalTCO2e.toFixed(3)} tCO₂e</span>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold">{editing ? "Edit Vehicle" : "Add Vehicle"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Scope 1 · Mobile Combustion</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Basic Info */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Vehicle Name / ID <span className="text-red-500">*</span></Label>
                <Input className="mt-1" placeholder="e.g. Sales Car 1" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>

              <LocationSelector value={form.location_id} onChange={v => set("location_id", v)} />

              {/* Vehicle Specs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Vehicle Type <span className="text-red-500">*</span></Label>
                  <Select value={form.vehicle_type} onValueChange={v => set("vehicle_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{VEHICLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Fuel Type <span className="text-red-500">*</span></Label>
                  <Select value={form.fuel_type} onValueChange={v => set("fuel_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{FUEL_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Optional details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-700">License Plate</Label>
                  <Input className="mt-1" placeholder="ABC 123" value={form.license_plate} onChange={e => set("license_plate", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">VIN <span className="text-xs text-slate-400">(recommended)</span></Label>
                  <Input className="mt-1" placeholder="17-char VIN" value={form.vin} onChange={e => set("vin", e.target.value)} />
                </div>
              </div>

              {/* Usage Data */}
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Usage Data</div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Usage Type <span className="text-red-500">*</span></Label>
                    <Select value={form.usage_type} onValueChange={v => set("usage_type", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{USAGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Quantity <span className="text-red-500">*</span></Label>
                    <Input type="number" className="mt-1" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                    <p className="text-xs text-slate-400 mt-0.5">{form.usage_type === "Distance (km)" ? "Total km driven this period" : "Total litres consumed this period"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Period Start <span className="text-red-500">*</span></Label>
                      <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Period End</Label>
                      <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Metadata</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Status</Label>
                    <Select value={form.status} onValueChange={v => set("status", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Notes</Label>
                    <Input className="mt-1" placeholder="Optional notes" value={form.notes} onChange={e => set("notes", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Emissions Preview */}
              {parseFloat(form.quantity) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs text-emerald-600 font-medium">Estimated Emissions</div>
                  <div className="text-2xl font-bold text-emerald-800 mt-0.5">
                    {estimatedTCO2e.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span>
                  </div>
                  <div className="text-xs text-emerald-600/70 mt-0.5">
                    Based on {form.fuel_type} · {form.usage_type}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.name}>Save Vehicle</Button>
            </div>
          </div>
        </div>
      )}

      <VehicleEmissionsDialog
        open={showEmissions}
        onClose={() => { setShowEmissions(false); setEmissionsVehicle(null); }}
        onSaved={load}
        vehicle={emissionsVehicle}
      />

      <BulkUploadModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        title="Vehicles"
        templateHeaders={TEMPLATE_HEADERS}
        exampleRows={EXAMPLE_ROWS}
        onUpload={handleBulkUpload}
      />
    </div>
  );
}