import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ChevronRight, Search, Upload, LayoutGrid, List, CheckCircle2, Circle, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const S3_CATEGORIES = [
  { num: 1, label: "Purchased Goods and Services", description: "Upstream emissions from production of purchased products", upstream: true, required: true },
  { num: 2, label: "Capital Goods", description: "Emissions from production of capital goods", upstream: true, required: true },
  { num: 3, label: "Fuel and Energy-Related Activities", description: "Extraction, production and transportation of fuels", upstream: true, required: true },
  { num: 4, label: "Upstream Transportation & Distribution", description: "Transportation of purchased products", upstream: true, required: true },
  { num: 5, label: "Waste Generated in Operations", description: "Disposal and treatment of waste from operations", upstream: true, required: true },
  { num: 6, label: "Business Travel", description: "Transportation of employees for business activities", upstream: true, required: true },
  { num: 7, label: "Employee Commuting", description: "Employee transportation between home and work", upstream: true, required: true },
  { num: 8, label: "Upstream Leased Assets", description: "Operation of assets leased by the reporting company", upstream: true, required: true },
  { num: 9, label: "Downstream Transportation & Distribution", description: "Transportation and distribution of sold products", upstream: false, required: false },
  { num: 10, label: "Processing of Sold Products", description: "Processing of intermediate products sold", upstream: false, required: false },
  { num: 11, label: "Use of Sold Products", description: "End use of goods and services sold by the company", upstream: false, required: false },
  { num: 12, label: "End-of-Life Treatment of Sold Products", description: "Waste disposal of sold products", upstream: false, required: false },
  { num: 13, label: "Downstream Leased Assets", description: "Operation of assets owned and leased to others", upstream: false, required: false },
  { num: 14, label: "Franchises", description: "Operation of franchises not in Scope 1 or 2", upstream: false, required: false },
  { num: 15, label: "Investments", description: "Operation of investments (equity, debt, project finance)", upstream: false, required: false },
];

// Data entry method options per category
const CALC_METHODS = {
  1: ["Spend-based", "Physical quantity"],
  2: ["Spend-based", "Physical quantity"],
  3: ["Activity-based"],
  4: ["Distance-based", "Spend-based"],
  5: ["Weight-based", "Spend-based"],
  6: ["Distance-based", "Spend-based"],
  7: ["Distance-based", "Survey-based"],
  8: ["Activity-based"],
  default: ["Spend-based", "Physical quantity", "Activity-based"],
};

function CategoryForm({ category, onClose, onSaved }) {
  const [locations, setLocations] = useState([]);
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("");
  const [form, setForm] = useState({
    location_id: "", location_name: "", supplier: "",
    start_date: "", end_date: "",
    quantity: "", unit: "USD", amount_paid: "", currency: "USD",
    notes: "", status: "Draft"
  });
  const [saving, setSaving] = useState(false);

  const methods = CALC_METHODS[category.num] || CALC_METHODS.default;

  useEffect(() => {
    base44.entities.Location.list().then(setLocations);
    setMethod(methods[0]);
  }, []);

  const unitByMethod = {
    "Spend-based": "USD", "Physical quantity": "t", "Distance-based": "km",
    "Weight-based": "kg", "Survey-based": "employees", "Activity-based": "units"
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const calcEmissions = () => {
    const qty = parseFloat(form.quantity) || 0;
    const spendFactor = 0.000233; // rough spend-based factor
    const distanceFactor = 0.00021;
    if (method === "Spend-based") return qty * spendFactor;
    if (method === "Distance-based") return qty * distanceFactor;
    return qty * 0.001;
  };

  const save = async () => {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    const tco2e = calcEmissions();
    await base44.entities.EmissionEntry.create({
      ...form,
      scope: "Scope 3",
      category: category.label,
      s3_category_number: category.num,
      location_name: loc?.name || form.location_name,
      calculation_method: method,
      quantity: parseFloat(form.quantity) || undefined,
      amount_paid: parseFloat(form.amount_paid) || undefined,
      tco2e: parseFloat(tco2e.toFixed(6)),
      reporting_year: 2024,
      unit: unitByMethod[method] || form.unit,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{category.num}</div>
              <span className="text-xs text-slate-500">Scope 3 · Category {category.num}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{category.label}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{category.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Choose method */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">01</div>
              <Label className="font-semibold text-slate-800">What type of data do you have?</Label>
            </div>
            <div className="space-y-2 ml-8">
              {methods.map(m => (
                <label key={m} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-emerald-600 w-4 h-4" />
                  <div>
                    <span className="text-sm text-slate-700 font-medium">{m}</span>
                    {m === methods[0] && <span className="ml-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full">Recommended</span>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: Fill data */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">02</div>
              <Label className="font-semibold text-slate-800">Enter your data</Label>
            </div>
            <div className="ml-8 space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Location</Label>
                <Select value={form.location_id} onValueChange={v => set("location_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select location..." /></SelectTrigger>
                  <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Start Date</Label>
                  <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">End Date</Label>
                  <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Supplier / Source</Label>
                <Input className="mt-1" placeholder="Supplier or source name" value={form.supplier} onChange={e => set("supplier", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {method === "Spend-based" ? "Amount Spent" : method === "Distance-based" ? "Distance" : "Quantity"}
                  </Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Unit</Label>
                  <Select value={unitByMethod[method] || form.unit} onValueChange={v => set("unit", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["USD", "EUR", "GBP", "km", "miles", "kg", "t", "kWh", "units", "employees"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {method === "Spend-based" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Amount Paid (for supplier spend tracking)</Label>
                  <Input type="number" className="mt-1" placeholder="0.00" value={form.amount_paid} onChange={e => set("amount_paid", e.target.value)} />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">Notes (optional)</Label>
                <Input className="mt-1" placeholder="Additional context..." value={form.notes} onChange={e => set("notes", e.target.value)} />
              </div>

              {/* Estimated emissions */}
              {parseFloat(form.quantity) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs text-emerald-600 font-medium">Estimated Emissions</div>
                  <div className="text-2xl font-bold text-emerald-800 mt-0.5">{calcEmissions().toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
                  <div className="text-xs text-emerald-600/70 mt-0.5">Based on {method.toLowerCase()} emission factors</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.quantity}>
            {saving ? "Saving..." : "Add Data"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Scope3Categories() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCat, setSelectedCat] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // "list" or "kanban"
  const [activeTab, setActiveTab] = useState("all");
  const [showUpload, setShowUpload] = useState(false);

  const load = () => base44.entities.EmissionEntry.filter({ scope: "Scope 3" }).then(setEntries);
  useEffect(() => { load(); }, []);

  const totalByCategory = entries.reduce((acc, e) => {
    if (e.s3_category_number) {
      acc[e.s3_category_number] = (acc[e.s3_category_number] || 0) + (e.tco2e || 0);
    }
    return acc;
  }, {});
  const totalTCO2e = Object.values(totalByCategory).reduce((a, b) => a + b, 0);
  const completedCats = Object.keys(totalByCategory).length;

  const openForm = (cat) => { setSelectedCat(cat); setShowForm(true); };

  const filteredCats = S3_CATEGORIES.filter(c => {
    const matchSearch = !search || c.label.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || (activeTab === "upstream" && c.upstream) || (activeTab === "downstream" && !c.upstream) || (activeTab === "measured" && totalByCategory[c.num]);
    return matchSearch && matchTab;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scope 3</h1>
          <p className="text-sm text-slate-500 mt-0.5">Value chain emissions across 15 upstream and downstream categories</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Optional kanban/upload view toggle */}
          <button
            onClick={() => setShowUpload(true)}
            className="text-xs text-slate-500 border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Upload className="w-3 h-3" /> Upload & Review
          </button>
          <button onClick={() => setViewMode(viewMode === "list" ? "kanban" : "list")}
            className="text-xs text-slate-500 border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
            <LayoutGrid className="w-3 h-3" /> {viewMode === "list" ? "Kanban view" : "List view"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Scope 3", value: `${totalTCO2e.toFixed(2)} tCO₂e`, highlight: true },
          { label: "Categories measured", value: `${completedCats} / 15` },
          { label: "Upstream measured", value: `${Object.entries(totalByCategory).filter(([k]) => parseInt(k) <= 8).length} / 8` },
          { label: "Entries recorded", value: entries.length },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.highlight ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
            <div className="text-xs text-slate-500 font-medium mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.highlight ? "text-blue-800" : "text-slate-900"}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {[
            { key: "all", label: "All categories" },
            { key: "upstream", label: "Upstream (1–8)" },
            { key: "downstream", label: "Downstream (9–15)" },
            { key: "measured", label: "With data" },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === t.key ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-8 text-sm w-52 h-9" placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* PRIMARY WORKFLOW: Category list */}
      {viewMode === "list" && (
        <div className="space-y-2">
          {/* Upstream group */}
          {(activeTab === "all" || activeTab === "upstream") && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Upstream Emissions</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {filteredCats.filter(c => c.upstream).map((cat, idx, arr) => {
                  const hasDat = totalByCategory[cat.num];
                  return (
                    <div key={cat.num} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group ${idx < arr.length - 1 ? "border-b border-slate-100" : ""}`}
                      onClick={() => openForm(cat)}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${hasDat ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {cat.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{cat.label}</span>
                          {!cat.required && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Optional</span>}
                        </div>
                        <span className="text-xs text-slate-400">{cat.description}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {hasDat ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span className="text-sm font-semibold text-emerald-700">{hasDat.toFixed(3)} tCO₂e</span>
                            </div>
                            <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">+ Add more</span>
                          </>
                        ) : (
                          <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Add data
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Downstream group */}
          {(activeTab === "all" || activeTab === "downstream") && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Downstream Emissions</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {filteredCats.filter(c => !c.upstream).map((cat, idx, arr) => {
                  const hasDat = totalByCategory[cat.num];
                  return (
                    <div key={cat.num} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group ${idx < arr.length - 1 ? "border-b border-slate-100" : ""}`}
                      onClick={() => openForm(cat)}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${hasDat ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                        {cat.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">{cat.label}</span>
                          <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">Optional</span>
                        </div>
                        <span className="text-xs text-slate-400">{cat.description}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {hasDat ? (
                          <span className="text-sm font-semibold text-emerald-700">{hasDat.toFixed(3)} tCO₂e</span>
                        ) : (
                          <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Add data
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "measured" && filteredCats.length === 0 && (
            <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
              No categories with data yet. Click any category above to add data.
            </div>
          )}
        </div>
      )}

      {/* OPTIONAL: Kanban view */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Needs data</span>
              <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2 py-0.5 rounded-full">{15 - completedCats}</span>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {S3_CATEGORIES.filter(c => !totalByCategory[c.num]).map(cat => (
                <div key={cat.num} className="p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors mb-1 group" onClick={() => openForm(cat)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-blue-500 font-medium">Cat. {cat.num}</div>
                      <div className="text-sm font-medium text-slate-700 leading-tight">{cat.label}</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Upload & Review</span>
              <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full">Optional</span>
            </div>
            <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
              <Upload className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">For bulk data entry, upload a file</p>
              <button onClick={() => setShowUpload(true)} className="mt-3 text-xs text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                <Upload className="w-3 h-3" /> Upload file
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Done</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-semibold">{totalTCO2e.toFixed(2)} tCO₂e</span>
                <span className="text-xs bg-emerald-50 text-emerald-600 font-medium px-2 py-0.5 rounded-full">{completedCats}</span>
              </div>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {S3_CATEGORIES.filter(c => totalByCategory[c.num]).map(cat => (
                <div key={cat.num} className="p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors mb-1" onClick={() => openForm(cat)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400">Cat. {cat.num}</div>
                        <div className="text-sm font-medium text-slate-700 leading-tight">{cat.label}</div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{(totalByCategory[cat.num] || 0).toFixed(2)}t</span>
                  </div>
                </div>
              ))}
              {completedCats === 0 && <div className="text-center py-8 text-sm text-slate-400">Completed categories appear here</div>}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Upload Scope 3 Data</h2>
              <button onClick={() => setShowUpload(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Upload supplier data files for bulk processing. Download our template first.</p>
            <a href="#" className="text-sm text-emerald-600 hover:underline flex items-center gap-1.5 mb-4">
              <Download className="w-3.5 h-3.5" /> Download template
            </a>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Drag and drop your file here or</p>
              <button className="text-sm text-emerald-600 hover:underline mt-1">select from your computer ›</button>
              <p className="text-xs text-slate-400 mt-2">CSV or XLSX · Max 10MB</p>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => setShowUpload(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {showForm && selectedCat && (
        <CategoryForm category={selectedCat} onClose={() => { setShowForm(false); setSelectedCat(null); }} onSaved={load} />
      )}
    </div>
  );
}