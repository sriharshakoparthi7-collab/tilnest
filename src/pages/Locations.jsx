import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, MapPin, Building2, Trash2, Edit2, X, Search, Upload, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BulkUploadModal from "../components/BulkUploadModal";

const TYPES = ["Office", "Warehouse", "Factory", "Data Center", "Retail", "Other"];

const TYPE_COLORS = {
  Office: "bg-blue-50 text-blue-700",
  Warehouse: "bg-amber-50 text-amber-700",
  Factory: "bg-orange-50 text-orange-700",
  "Data Center": "bg-purple-50 text-purple-700",
  Retail: "bg-emerald-50 text-emerald-700",
  Other: "bg-slate-100 text-slate-600",
};

const TEMPLATE_HEADERS = ["name", "type", "address", "city", "country", "floor_area_m2"];
const EXAMPLE_ROWS = [
  ["Sydney HQ", "Office", "123 George St", "Sydney", "Australia", "2500"],
  ["Melbourne Warehouse", "Warehouse", "45 Industrial Ave", "Melbourne", "Australia", "8000"],
];

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [emissions, setEmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState({ name: "", address: "", city: "", country: "", type: "Office", floor_area_m2: "" });

  const load = async () => {
    const [locs, ems] = await Promise.all([
      base44.entities.Location.list(),
      base44.entities.EmissionEntry.list(),
    ]);
    setLocations(locs);
    setEmissions(ems);
    setLoading(false);
  };

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

  const bulkDelete = async () => {
    await Promise.all([...selected].map(id => base44.entities.Location.delete(id)));
    setSelected(new Set());
    load();
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
      await base44.entities.Location.create({
        name: row.name,
        type: row.type || "Other",
        address: row.address,
        city: row.city,
        country: row.country,
        floor_area_m2: parseFloat(row.floor_area_m2) || undefined,
      });
      created++;
    }
    load();
    return { created, skipped, errors: [] };
  };

  const emissionsByLocation = emissions.reduce((acc, e) => {
    if (e.location_id) acc[e.location_id] = (acc[e.location_id] || 0) + (e.tco2e || 0);
    return acc;
  }, {});

  const filtered = locations.filter(l =>
    (typeFilter === "All" || l.type === typeFilter) &&
    (!search || l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.city || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.country || "").toLowerCase().includes(search.toLowerCase()))
  );

  const totalLocations = locations.length;
  const totalArea = locations.reduce((s, l) => s + (l.floor_area_m2 || 0), 0);
  const totalEmissions = Object.values(emissionsByLocation).reduce((s, v) => s + v, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your facilities, offices and sites</p>
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
            <Plus className="w-4 h-4" /> Add Location
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Locations", value: totalLocations, icon: MapPin, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total Floor Area", value: `${totalArea.toLocaleString()} m²`, icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Emissions Tracked", value: `${totalEmissions.toFixed(2)} tCO₂e`, icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
            </div>
            <div>
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-lg font-bold text-slate-900">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-8 h-9 w-56 text-sm" placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {["All", ...TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${typeFilter === t ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} location{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Location Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">{search || typeFilter !== "All" ? "No locations match your filters" : "No locations yet"}</h3>
          <p className="text-sm text-slate-500 mb-4">Add your offices, warehouses and facilities to track emissions by site</p>
          <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add First Location</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(loc => {
            const locEmissions = emissionsByLocation[loc.id] || 0;
            const isSelected = selected.has(loc.id);
            return (
              <div
                key={loc.id}
                className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-all ${isSelected ? "border-emerald-400 ring-1 ring-emerald-300" : "border-slate-200"}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(loc.id)}
                      className="mt-1 accent-emerald-600 w-3.5 h-3.5 flex-shrink-0" />
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{loc.name}</div>
                      <div className="text-xs text-slate-500">{[loc.city, loc.country].filter(Boolean).join(", ") || "—"}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(loc)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(loc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {loc.type && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[loc.type] || TYPE_COLORS.Other}`}>{loc.type}</span>}
                  {loc.floor_area_m2 && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{loc.floor_area_m2.toLocaleString()} m²</span>}
                </div>

                {loc.address && <div className="text-xs text-slate-400 mb-3 truncate">{loc.address}</div>}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">Tracked emissions</div>
                  <div className={`text-sm font-bold ${locEmissions > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                    {locEmissions > 0 ? `${locEmissions.toFixed(3)} tCO₂e` : "No data yet"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">{editing ? "Edit Location" : "Add Location"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-medium">Location Name <span className="text-red-500">*</span></Label>
                <Input className="mt-1" placeholder="e.g. Sydney HQ" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
              <div>
                <Label className="text-sm font-medium">Address</Label>
                <Input className="mt-1" placeholder="Street address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
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
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.name}>Save Location</Button>
            </div>
          </div>
        </div>
      )}

      <BulkUploadModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        title="Locations"
        templateHeaders={TEMPLATE_HEADERS}
        exampleRows={EXAMPLE_ROWS}
        onUpload={handleBulkUpload}
      />
    </div>
  );
}