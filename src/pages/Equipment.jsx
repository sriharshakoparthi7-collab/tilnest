import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Upload, Trash2, Edit2, Zap, Search, Download, Activity } from "lucide-react";
import EquipmentEmissionsDialog from "../components/EquipmentEmissionsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EquipmentForm from "@/components/equipment/EquipmentForm";
import BulkUploadModal from "@/components/BulkUploadModal";
import { BULK_TEMPLATE_HEADERS, BULK_EXAMPLE_ROWS, calculateEquipmentEmissions, UNIT_FOR_MEASUREMENT } from "@/utils/equipmentHelpers";

const STATUS_COLORS = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-500",
  Retired: "bg-red-50 text-red-500",
};

export default function Equipment() {
  const [equipment, setEquipment] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showEmissions, setShowEmissions] = useState(false);
  const [emissionsEquipment, setEmissionsEquipment] = useState(null);

  const load = async () => {
    setLoading(true);
    const [eq, locs] = await Promise.all([
      base44.entities.Equipment.list("-created_date"),
      base44.entities.Location.list(),
    ]);
    setEquipment(eq);
    setLocations(locs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteEquipment = async (id) => {
    await base44.entities.Equipment.delete(id);
    setEquipment(e => e.filter(x => x.id !== id));
  };

  const filtered = equipment.filter(e => {
    const matchSearch = !search || e.equipment_name?.toLowerCase().includes(search.toLowerCase()) || e.location_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || e.equipment_type === filterType;
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const totalTCO2e = filtered.reduce((s, e) => s + (e.tco2e || 0), 0);
  const activeCount = equipment.filter(e => e.status === "Active").length;

  const allTypes = [...new Set(equipment.map(e => e.equipment_type).filter(Boolean))];

  const handleBulkUpload = async (rows) => {
    let created = 0, skipped = 0;
    for (const row of rows) {
      if (!row.equipment_name || !row.equipment_type || !row.power_source) { skipped++; continue; }
      const fakeForm = { measurement_type: row.measurement_type, quantity: row.quantity, power_source: row.power_source, equipment_type: row.equipment_type };
      const { tco2e, method } = calculateEquipmentEmissions(fakeForm);
      const loc = locations.find(l => l.name?.toLowerCase() === row.location_name?.toLowerCase());
      await base44.entities.Equipment.create({
        equipment_name: row.equipment_name,
        equipment_type: row.equipment_type,
        equipment_subtype: row.equipment_subtype || "",
        location_id: loc?.id || "",
        location_name: row.location_name || "",
        power_source: row.power_source,
        activity_type: row.activity_type || "Intermittent",
        measurement_type: row.measurement_type || "Fuel Consumption (L)",
        quantity: parseFloat(row.quantity) || 0,
        unit: UNIT_FOR_MEASUREMENT[row.measurement_type] || "units",
        start_date: row.start_date || "",
        end_date: row.end_date || "",
        reporting_period: row.reporting_period || "Monthly",
        manufacturer: row.manufacturer || "",
        model: row.model || "",
        equipment_age_years: parseFloat(row.equipment_age_years) || undefined,
        status: row.status || "Active",
        notes: row.notes || "",
        tco2e: parseFloat(tco2e.toFixed(6)),
        calculation_method: method,
      });
      created++;
    }
    await load();
    return { created, skipped };
  };

  const exportCSV = () => {
    const headers = ["equipment_name","equipment_type","location_name","power_source","measurement_type","quantity","unit","start_date","tco2e","status"];
    const rows = filtered.map(e => headers.map(h => e[h] ?? "").join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "equipment_registry.csv"; a.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-orange-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Equipment Registry</h1>
          </div>
          <p className="text-sm text-slate-500 ml-10">Track machinery and stationary equipment · Scope 1 emissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Bulk Upload
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setEmissionsEquipment(null); setShowEmissions(true); }} className="gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Log Emissions
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Equipment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Equipment", value: equipment.length, sub: `${activeCount} active` },
          { label: "Active Emissions", value: `${totalTCO2e.toFixed(3)} tCO₂e`, sub: "Scope 1 estimate" },
          { label: "Filtered Results", value: filtered.length, sub: "matching current filters" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-9" placeholder="Search equipment..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {allTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Active","Inactive","Retired"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-16 text-center">
          <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="font-semibold text-slate-600">{equipment.length === 0 ? "No equipment yet" : "No results"}</div>
          <p className="text-sm text-slate-400 mt-1">{equipment.length === 0 ? "Add your first piece of equipment to start tracking emissions." : "Try adjusting your filters."}</p>
          {equipment.length === 0 && (
            <Button className="mt-4 gap-1.5" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add Equipment
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                {["Name / ID","Type","Location","Power","Measurement","Quantity","Emissions","Status",""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(eq => (
                <tr key={eq.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{eq.equipment_name}</div>
                    {eq.equipment_subtype && <div className="text-xs text-slate-400">{eq.equipment_subtype}</div>}
                  </td>
                  <td className="py-3 px-4 text-slate-700">{eq.equipment_type}</td>
                  <td className="py-3 px-4 text-slate-600">{eq.location_name || "—"}</td>
                  <td className="py-3 px-4 text-slate-600">{eq.power_source}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{eq.measurement_type}</td>
                  <td className="py-3 px-4 font-medium">{eq.quantity} <span className="text-slate-400 font-normal text-xs">{eq.unit}</span></td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{(eq.tco2e || 0).toFixed(4)}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[eq.status] || STATUS_COLORS.Active}`}>{eq.status}</span>
                  </td>
                  <td className="py-3 px-4">
                   <div className="flex items-center gap-1">
                     <button onClick={() => { setEmissionsEquipment(eq); setShowEmissions(true); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600" title="Log Emissions"><Activity className="w-3.5 h-3.5" /></button>
                     <button onClick={() => { setEditing(eq); setFormOpen(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                     <button onClick={() => deleteEquipment(eq.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                   </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <EquipmentEmissionsDialog
        open={showEmissions}
        onClose={() => { setShowEmissions(false); setEmissionsEquipment(null); }}
        onSaved={load}
        equipment={emissionsEquipment}
      />

      <EquipmentForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={load}
        defaultValues={editing || {}}
      />

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Equipment Registry"
        templateHeaders={BULK_TEMPLATE_HEADERS}
        exampleRows={BULK_EXAMPLE_ROWS}
        onUpload={handleBulkUpload}
      />
    </div>
  );
}