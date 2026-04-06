import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, MapPin, Building2, Trash2, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPES = ["Office", "Warehouse", "Factory", "Data Center", "Retail", "Other"];

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", country: "", type: "Office", floor_area_m2: "" });

  const load = () => base44.entities.Location.list().then(d => { setLocations(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: "", address: "", city: "", country: "", type: "Office", floor_area_m2: "" }); setShowForm(true); };
  const openEdit = (loc) => { setEditing(loc); setForm({ ...loc, floor_area_m2: loc.floor_area_m2 || "" }); setShowForm(true); };

  const save = async () => {
    const data = { ...form, floor_area_m2: parseFloat(form.floor_area_m2) || undefined };
    if (editing) await base44.entities.Location.update(editing.id, data);
    else await base44.entities.Location.create(data);
    setShowForm(false);
    load();
  };

  const remove = async (id) => { await base44.entities.Location.delete(id); load(); };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Locations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your facilities and offices</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Location
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : locations.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No locations yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your offices, warehouses and facilities</p>
          <Button onClick={openAdd} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Add First Location</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{loc.name}</div>
                    <div className="text-sm text-muted-foreground">{[loc.city, loc.country].filter(Boolean).join(", ")}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(loc)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(loc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {loc.type && <span className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">{loc.type}</span>}
                {loc.address && <span className="text-xs text-muted-foreground">{loc.address}</span>}
                {loc.floor_area_m2 && <span className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">{loc.floor_area_m2} m²</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editing ? "Edit Location" : "Add Location"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-medium">Location Name *</Label>
                <Input className="mt-1" placeholder="e.g. London HQ" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">City</Label>
                  <Input className="mt-1" placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Country</Label>
                  <Input className="mt-1" placeholder="Country" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Address</Label>
                <Input className="mt-1" placeholder="Street address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Floor Area (m²)</Label>
                  <Input className="mt-1" type="number" placeholder="0" value={form.floor_area_m2} onChange={e => setForm(f => ({ ...f, floor_area_m2: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-border">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.name}>Save Location</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}