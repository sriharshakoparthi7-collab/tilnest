import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Car, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VEHICLE_TYPES = ["Car-Average", "Heavy Goods Vehicle (Truck)-Average", "Motorbike-Average", "Van-Average", "Bus"];
const FUEL_TYPES = ["Petrol", "Diesel", "LPG", "CNG", "Hybrid"];
const USAGE_TYPES = ["Vehicle Usage (Distance)", "Vehicle Usage (Fuel)"];

export default function Scope1Vehicles() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    source_name: "", vehicle_type: "Car-Average", fuel_type: "Petrol",
    usage_type: "Vehicle Usage (Fuel)", quantity: "", unit: "L",
    location_id: "", location_name: "", start_date: "", end_date: "",
    notes: "", status: "Draft"
  });
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = () => base44.entities.EmissionEntry.filter({ scope: "Scope 1", category: "Mobile Combustion" }).then(d => { setEntries(d); setLoading(false); });

  useEffect(() => {
    load();
    base44.entities.Location.list().then(setLocations);
  }, []);

  const handleUsageTypeChange = (v) => {
    setForm(f => ({ ...f, usage_type: v, unit: v === "Vehicle Usage (Distance)" ? "km" : "L" }));
  };

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const factor = form.usage_type === "Vehicle Usage (Fuel)" ? 2.31 : 0.21; // kg CO2e/L or /km
    const tco2e = ((parseFloat(form.quantity) || 0) * factor) / 1000;
    await base44.entities.EmissionEntry.create({
      ...form,
      scope: "Scope 1",
      category: "Mobile Combustion",
      sub_category: form.vehicle_type,
      location_name: loc?.name || "",
      quantity: parseFloat(form.quantity) || undefined,
      tco2e: parseFloat(tco2e.toFixed(6)),
      reporting_year: 2024,
    });
    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleDelete = async (id) => { await base44.entities.EmissionEntry.delete(id); load(); };

  const totalTCO2e = entries.reduce((s, e) => s + (e.tco2e || 0), 0);
  const filtered = entries.filter(e => !search || (e.source_name || "").toLowerCase().includes(search.toLowerCase()));
  const needsData = entries.filter(e => !e.quantity || e.quantity === 0);
  const done = entries.filter(e => e.quantity && e.quantity > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Car className="w-4 h-4 text-emerald-600" />
            <span>Scope 1</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Company Vehicles</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Emissions from owned or controlled vehicles used for business activities</p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Add Vehicle Data
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Emissions", value: `${totalTCO2e.toFixed(3)} tCO₂e` },
          { label: "Vehicles Tracked", value: entries.length },
          { label: "Data Complete", value: done.length + "/" + entries.length },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1 font-medium">{s.label}</div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Columns Layout like Persefoni */}
      {!loading && entries.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-9 text-sm" placeholder="Search vehicles..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-medium text-amber-600">{needsData.length} Needs data added</span>
              </div>
              {needsData.map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Car className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{e.source_name}</div>
                      <div className="text-xs text-muted-foreground">{e.sub_category} · {e.location_name || "No location"}</div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-medium text-emerald-600">{done.length} Done</span>
              </div>
              {done.map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Car className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        {e.source_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{e.sub_category} · {e.quantity} {e.unit}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-700">{(e.tco2e || 0).toFixed(3)} t</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-14 bg-card border border-dashed border-border rounded-xl">
          <Car className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-1">No vehicle data yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Track emissions from your company-owned vehicles</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Add Vehicle Data</Button>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-bold">Add Vehicle Data</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Add an ICEV to your 2024 reporting year</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-semibold">What is the name or ID of this vehicle? *</Label>
                <Input className="mt-1" placeholder="Give this vehicle a name or ID" value={form.source_name} onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))} />
              </div>

              <div>
                <Label className="text-sm font-semibold">What usage data do you have? *</Label>
                <div className="mt-2 space-y-2">
                  {USAGE_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="usage" checked={form.usage_type === t} onChange={() => handleUsageTypeChange(t)} className="accent-emerald-600" />
                      <span className="text-sm">{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">What kind of vehicle is this? *</Label>
                <div className="mt-2 space-y-2">
                  {VEHICLE_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="vtype" checked={form.vehicle_type === t} onChange={() => setForm(f => ({ ...f, vehicle_type: t }))} className="accent-emerald-600" />
                      <span className="text-sm">{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Fuel Type</Label>
                <Select value={form.fuel_type} onValueChange={v => setForm(f => ({ ...f, fuel_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{FUEL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Quantity</Label>
                  <Input type="number" className="mt-1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Unit</Label>
                  <Input className="mt-1" value={form.unit} readOnly />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Where is this vehicle located? <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <Select value={form.location_id} onValueChange={v => setForm(f => ({ ...f, location_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select location..." /></SelectTrigger>
                  <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Start Date</Label>
                  <Input type="date" className="mt-1" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date</Label>
                  <Input type="date" className="mt-1" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-border">
              <Button variant="ghost" onClick={() => setShowForm(false)}>← Back</Button>
              <Button onClick={save} disabled={saving || !form.source_name}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}