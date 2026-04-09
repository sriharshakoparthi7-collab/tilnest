import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Car, Trash2, Edit2, X, Search, Upload, CheckCircle2, Circle, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationSelector from "../components/LocationSelector";
import BulkUploadModal from "../components/BulkUploadModal";

const VEHICLE_TYPES = ["Car", "Van", "Truck", "Motorcycle", "Bus", "Heavy Vehicle", "Other"];
const FUEL_TYPES = ["Petrol", "Diesel", "LPG", "Electric", "Hybrid", "Hydrogen", "Other"];
const OWNERSHIP_TYPES = ["Owned", "Leased", "Hire", "Employee-owned"];
const STATUS_OPTS = ["Active", "Inactive", "Sold", "Pending Data"];

const EMISSION_FACTORS = { Petrol: 2.31, Diesel: 2.68, LPG: 1.51, Electric: 0.0, Hybrid: 1.5, Hydrogen: 0.0, Other: 2.0 };
const FUEL_EFFICIENCY = { Car: 8.5, Van: 12, Truck: 28, Motorcycle: 4, Bus: 35, "Heavy Vehicle": 45, Other: 10 }; // L/100km

const TEMPLATE_HEADERS = ["name", "license_plate", "make", "model", "year", "vehicle_type", "fuel_type", "ownership", "annual_km", "location_name"];
const EXAMPLE_ROWS = [
  ["Sales Car 1", "ABC123", "Toyota", "Corolla", "2022", "Car", "Petrol", "Owned", "25000", "Sydney HQ"],
  ["Delivery Van", "XYZ456", "Ford", "Transit", "2021", "Van", "Diesel", "Leased", "40000", "Melbourne Warehouse"],
];

const STATUS_COLORS = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-500",
  Sold: "bg-red-50 text-red-600",
  "Pending Data": "bg-amber-50 text-amber-600",
};

const FUEL_COLORS = {
  Electric: "bg-blue-50 text-blue-700", Hybrid: "bg-teal-50 text-teal-700",
  Hydrogen: "bg-cyan-50 text-cyan-700", Petrol: "bg-amber-50 text-amber-700",
  Diesel: "bg-orange-50 text-orange-700", LPG: "bg-purple-50 text-purple-700",
  Other: "bg-slate-100 text-slate-500",
};

const emptyForm = { name: "", vin: "", license_plate: "", make: "", model: "", year: "", vehicle_type: "Car", fuel_type: "Petrol", ownership: "Owned", status: "Active", location_id: "", location_name: "", department: "", odometer_km: "", annual_km: "", notes: "" };

export default function VehicleRegistry() {
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [fuelFilter, setFuelFilter] = useState("All");
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState(emptyForm);

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
    const data = { ...form, location_name: loc?.name || form.location_name, year: parseInt(form.year) || undefined, odometer_km: parseFloat(form.odometer_km) || undefined, annual_km: parseFloat(form.annual_km) || undefined };
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
      await base44.entities.Vehicle.create({ ...row, year: parseInt(row.year) || undefined, annual_km: parseFloat(row.annual_km) || undefined });
      created++;
    }
    load();
    return { created, skipped, errors: [] };
  };

  const estimateAnnualTCO2e = (v) => {
    if (!v.annual_km) return null;
    const efficiency = FUEL_EFFICIENCY[v.vehicle_type] || 10;
    const ef = EMISSION_FACTORS[v.fuel_type] || 2.0;
    return (v.annual_km / 100 * efficiency * ef / 1000).toFixed(3);
  };

  const filtered = vehicles.filter(v =>
    (statusFilter === "All" || v.status === statusFilter) &&
    (fuelFilter === "All" || v.fuel_type === fuelFilter) &&
    (!search || (v.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.license_plate || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.make || "").toLowerCase().includes(search.toLowerCase()))
  );

  const needsData = filtered.filter(v => !v.annual_km || v.status === "Pending Data");
  const hasData = filtered.filter(v => v.annual_km && v.status !== "Pending Data");
  const totalEstTCO2e = vehicles.reduce((s, v) => s + parseFloat(estimateAnnualTCO2e(v) || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vehicle Registry</h1>
          <p className="text-sm text-slate-500 mt-0.5">Scope 1 — Mobile combustion fleet tracking</p>
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
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Vehicle
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Vehicles", value: vehicles.length },
          { label: "Active", value: vehicles.filter(v => v.status === "Active").length },
          { label: "Pending Data", value: needsData.length, warn: needsData.length > 0 },
          { label: "Est. Annual tCO₂e", value: totalEstTCO2e.toFixed(2) },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.warn ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
            <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            <div className={`text-2xl font-bold mt-0.5 ${s.warn ? "text-amber-700" : "text-slate-900"}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-8 h-9 w-52 text-sm" placeholder="Search by name, plate, make..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option>All</option>
          {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={fuelFilter} onChange={e => setFuelFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option>All</option>
          {FUEL_TYPES.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      {/* Two-column layout: Needs Data | Complete */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Needs Data */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-slate-700">Needs Data</span>
              </div>
              <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2 py-0.5 rounded-full">{needsData.length}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {needsData.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">All vehicles have data ✓</div>
              ) : needsData.map(v => (
                <VehicleRow key={v.id} v={v} selected={selected.has(v.id)} onToggle={() => toggleSelect(v.id)} onEdit={() => openEdit(v)} onDelete={() => remove(v.id)} estimate={estimateAnnualTCO2e(v)} />
              ))}
            </div>
          </div>

          {/* Complete */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-slate-700">Complete</span>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-600 font-medium px-2 py-0.5 rounded-full">{hasData.length}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {hasData.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">Add annual_km to vehicles to see them here</div>
              ) : hasData.map(v => (
                <VehicleRow key={v.id} v={v} selected={selected.has(v.id)} onToggle={() => toggleSelect(v.id)} onEdit={() => openEdit(v)} onDelete={() => remove(v.id)} estimate={estimateAnnualTCO2e(v)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && vehicles.length === 0 && (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
          <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No vehicles registered</h3>
          <p className="text-sm text-slate-500 mb-4">Add your fleet to start tracking Scope 1 mobile combustion emissions</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2"><Upload className="w-4 h-4" /> Bulk Upload</Button>
            <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add Vehicle</Button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editing ? "Edit Vehicle" : "Add Vehicle"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Vehicle Name / Label <span className="text-red-500">*</span></Label>
                  <Input className="mt-1" placeholder="e.g. Sales Car 1" value={form.name} onChange={e => set("name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">License Plate</Label>
                  <Input className="mt-1" placeholder="ABC 123" value={form.license_plate} onChange={e => set("license_plate", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">VIN</Label>
                  <Input className="mt-1" placeholder="17-char VIN" value={form.vin} onChange={e => set("vin", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Make</Label>
                  <Input className="mt-1" placeholder="e.g. Toyota" value={form.make} onChange={e => set("make", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Model</Label>
                  <Input className="mt-1" placeholder="e.g. Hilux" value={form.model} onChange={e => set("model", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Year</Label>
                  <Input type="number" className="mt-1" placeholder="2023" value={form.year} onChange={e => set("year", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Vehicle Type</Label>
                  <Select value={form.vehicle_type} onValueChange={v => set("vehicle_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{VEHICLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Fuel Type</Label>
                  <Select value={form.fuel_type} onValueChange={v => set("fuel_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{FUEL_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Ownership</Label>
                  <Select value={form.ownership} onValueChange={v => set("ownership", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{OWNERSHIP_TYPES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={form.status} onValueChange={v => set("status", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Annual Distance (km)</Label>
                  <Input type="number" className="mt-1" placeholder="25000" value={form.annual_km} onChange={e => set("annual_km", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Odometer (km)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.odometer_km} onChange={e => set("odometer_km", e.target.value)} />
                </div>
              </div>
              <LocationSelector value={form.location_id} onChange={v => set("location_id", v)} />
              <div>
                <Label className="text-sm font-medium">Department</Label>
                <Input className="mt-1" placeholder="e.g. Sales, Operations" value={form.department} onChange={e => set("department", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Notes</Label>
                <Input className="mt-1" placeholder="Any additional notes..." value={form.notes} onChange={e => set("notes", e.target.value)} />
              </div>

              {parseFloat(form.annual_km) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-xs text-emerald-600 font-medium">Est. Annual Emissions</div>
                  <div className="text-xl font-bold text-emerald-800 mt-0.5">
                    {(() => {
                      const eff = FUEL_EFFICIENCY[form.vehicle_type] || 10;
                      const ef = EMISSION_FACTORS[form.fuel_type] || 2.0;
                      return (parseFloat(form.annual_km) / 100 * eff * ef / 1000).toFixed(3);
                    })()} <span className="text-sm font-normal">tCO₂e / year</span>
                  </div>
                  <div className="text-xs text-emerald-600/70">Based on avg fuel efficiency · Scope 1 Cat Mobile Combustion</div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.name}>Save Vehicle</Button>
            </div>
          </div>
        </div>
      )}

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

function VehicleRow({ v, selected, onToggle, onEdit, onDelete, estimate }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors ${selected ? "bg-emerald-50/50" : ""}`}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="accent-emerald-600 w-3.5 h-3.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{v.name}</span>
          {v.license_plate && <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">{v.license_plate}</span>}
          {v.fuel_type && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${FUEL_COLORS[v.fuel_type] || ""}`}>{v.fuel_type}</span>}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {[v.year, v.make, v.model, v.vehicle_type].filter(Boolean).join(" · ")}
          {v.location_name && ` · ${v.location_name}`}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {estimate ? <div className="text-sm font-semibold text-emerald-700">{estimate} tCO₂e</div> : <div className="text-xs text-amber-500">No km data</div>}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}