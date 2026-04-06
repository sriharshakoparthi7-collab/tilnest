import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Globe, ChevronRight, Search, Plus, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AddEntryDialog from "../components/AddEntryDialog";

const S3_CATEGORIES = [
  { num: 1, label: "Purchased Goods and Services", description: "Upstream emissions from production of purchased products", standard: true },
  { num: 2, label: "Capital Goods", description: "Emissions from production of capital goods purchased", standard: true },
  { num: 3, label: "Fuel and Energy-Related Activities (Not in Scope 1 & 2)", description: "Extraction, production and transportation of fuels", standard: true },
  { num: 4, label: "Upstream Transportation & Distribution", description: "Transportation and distribution of purchased products", standard: true },
  { num: 5, label: "Waste Generated in Operations", description: "Disposal and treatment of waste from operations", standard: true },
  { num: 6, label: "Business Travel", description: "Transportation of employees for business activities", standard: true },
  { num: 7, label: "Employee Commuting", description: "Transportation of employees between home and work", standard: true },
  { num: 8, label: "Upstream Leased Assets", description: "Operation of assets leased by reporting company", standard: true },
  { num: 9, label: "Downstream Transportation & Distribution", description: "Transportation and distribution of sold products", standard: false },
  { num: 10, label: "Processing of Sold Products", description: "Processing of intermediate products by third parties", standard: false },
  { num: 11, label: "Use of Sold Products", description: "End use of goods and services sold", standard: false },
  { num: 12, label: "End-of-Life Treatment of Sold Products", description: "Waste disposal and treatment of sold products", standard: false },
  { num: 13, label: "Downstream Leased Assets", description: "Operation of assets owned and leased to others", standard: false },
  { num: 14, label: "Franchises", description: "Operation of franchises not included in Scope 1 or 2", standard: false },
  { num: 15, label: "Investments", description: "Operation of investments (equity, debt, project finance)", standard: false },
];

export default function Scope3Categories() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedCat, setSelectedCat] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    base44.entities.EmissionEntry.filter({ scope: "Scope 3" }).then(setEntries);
  }, []);

  const totalByCategory = entries.reduce((acc, e) => {
    if (e.s3_category_number) acc[e.s3_category_number] = (acc[e.s3_category_number] || 0) + (e.tco2e || 0);
    return acc;
  }, {});

  const totalTCO2e = Object.values(totalByCategory).reduce((a, b) => a + b, 0);
  const completedCats = Object.keys(totalByCategory).length;

  const filtered = S3_CATEGORIES.filter(c => {
    const matchSearch = !search || c.label.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || (activeTab === "upstream" && c.num <= 8) || (activeTab === "downstream" && c.num > 8);
    return matchSearch && matchTab;
  });

  const openAdd = (cat) => {
    setSelectedCat(cat);
    setShowDialog(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Globe className="w-4 h-4 text-blue-500" />
            <span>Scope 3</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Value Chain Emissions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All indirect emissions across 15 upstream and downstream categories</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
            {completedCats}/15 categories with data
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Scope 3 Emissions", value: `${totalTCO2e.toFixed(3)} tCO₂e` },
          { label: "Categories Measured", value: `${completedCats} / 15` },
          { label: "Upstream Emissions", value: `${Object.entries(totalByCategory).filter(([k]) => parseInt(k) <= 8).reduce((s, [, v]) => s + v, 0).toFixed(3)} tCO₂e` },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1 font-medium">{s.label}</div>
            <div className="text-xl font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Kanban/Column View like Persefoni */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Upload Data Column */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Categories</span>
              <span className="bg-muted text-muted-foreground text-xs rounded-full px-2 py-0.5">{15 - completedCats}</span>
            </div>
            <span className="text-xs text-muted-foreground">Add Data</span>
          </div>
          <div className="p-2 max-h-[500px] overflow-y-auto">
            {S3_CATEGORIES.filter(c => !totalByCategory[c.num]).map(cat => (
              <div key={cat.num} className="p-3 rounded-lg hover:bg-muted/40 transition-colors mb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-blue-500 font-medium">Category {cat.num}</div>
                    <div className="text-sm font-medium text-foreground truncate">{cat.label}</div>
                    {!cat.standard && <span className="text-xs text-muted-foreground">Optional</span>}
                  </div>
                  <button onClick={() => openAdd(cat)} className="flex-shrink-0 text-xs text-primary hover:underline font-medium">+ Add Data</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* In Review Column (Upload feature — optional) */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Upload & Review</span>
              <span className="bg-blue-50 text-blue-600 text-xs rounded-full px-2 py-0.5">Optional</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <Upload className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Upload supplier data files for bulk processing</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Download template → fill → upload</p>
            <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
              <Upload className="w-3 h-3" /> Upload File
            </Button>
          </div>
        </div>

        {/* Done Column */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Done</span>
              <span className="bg-emerald-50 text-emerald-600 text-xs rounded-full px-2 py-0.5">{completedCats}</span>
            </div>
            <span className="text-xs font-medium text-emerald-600">{totalTCO2e.toFixed(2)} tCO₂e</span>
          </div>
          <div className="p-2 max-h-[500px] overflow-y-auto">
            {S3_CATEGORIES.filter(c => totalByCategory[c.num]).map(cat => (
              <div key={cat.num} className="p-3 rounded-lg hover:bg-muted/40 transition-colors mb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="text-xs text-muted-foreground">Category {cat.num}</div>
                    </div>
                    <div className="text-sm font-medium text-foreground truncate">{cat.label}</div>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 flex-shrink-0">{(totalByCategory[cat.num] || 0).toFixed(3)} t</div>
                </div>
              </div>
            ))}
            {completedCats === 0 && (
              <div className="text-center py-8 text-muted-foreground/50 text-sm">After adding data, completed categories appear here</div>
            )}
          </div>
        </div>
      </div>

      {/* Category Detail Table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Category Summary</h3>
          <div className="flex items-center gap-2">
            {["all", "upstream", "downstream"].map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${activeTab === t ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {filtered.map(cat => (
            <div key={cat.num} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${totalByCategory[cat.num] ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {cat.num}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{cat.label}</div>
                  <div className="text-xs text-muted-foreground">{cat.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {!cat.standard && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>}
                <div className="text-sm font-semibold text-right min-w-[80px]">
                  {totalByCategory[cat.num] ? (
                    <span className="text-emerald-700">{totalByCategory[cat.num].toFixed(3)} t</span>
                  ) : (
                    <button onClick={() => openAdd(cat)} className="text-xs text-primary hover:underline">+ Add data</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showDialog && selectedCat && (
        <AddEntryDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setSelectedCat(null); }}
          onSaved={() => base44.entities.EmissionEntry.filter({ scope: "Scope 3" }).then(setEntries)}
          scope="Scope 3"
          category={selectedCat.label}
          subCategory={`Category ${selectedCat.num}`}
          defaultValues={{ s3_category_number: selectedCat.num }}
        />
      )}
    </div>
  );
}