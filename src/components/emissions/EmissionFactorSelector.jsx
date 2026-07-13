import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getFactorsByCountry, getBestFactor, getCountriesForCategory, getYearsForCategory,
  normalizeCountry, adjustSpendForFactor, mergeFactors, getQualityTierLabel,
  QUALITY_TIER_LABELS
} from "@/utils/emissionFactorLibrary";
import { Plus, AlertCircle, CheckCircle2, Sparkles, ChevronDown, ChevronUp, Info, DollarSign, TrendingUp, Ban } from "lucide-react";

export default function EmissionFactorSelector({
  category,
  locationId,
  locations,
  reportingYear = new Date().getFullYear(),
  spendCurrency = "USD",
  spendAmount = 0,
  selectedFactorId,
  onSelect,
  onNoData,
  noDataFlagged = false,
}) {
  const [expanded, setExpanded] = useState(true);
  const [countryFilter, setCountryFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [customFactors, setCustomFactors] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({
    factor_name: "", country: "", year: reportingYear, value: "", unit: "",
    source: "", justification: "", quality_tier: 3,
  });
  const [savingCustom, setSavingCustom] = useState(false);

  // Auto-detect country from selected location
  const detectedCountry = useMemo(() => {
    const loc = locations?.find(l => l.id === locationId);
    return normalizeCountry(loc?.country || loc?.city || "Global");
  }, [locationId, locations]);

  // Auto-update country filter when facility location changes
  useEffect(() => {
    if (detectedCountry) {
      setCountryFilter(detectedCountry);
    }
  }, [detectedCountry]);

  // Load custom factors
  useEffect(() => {
    base44.entities.CustomEmissionFactor.filter({ category, is_active: true })
      .then(setCustomFactors)
      .catch(() => {});
  }, [category]);

  // Get all factors (standard + custom) for this category
  const allFactors = useMemo(() => {
    const standard = getFactorsByCountry(category, countryFilter || detectedCountry);
    return mergeFactors(standard, customFactors);
  }, [category, countryFilter, detectedCountry, customFactors]);

  // Apply year filter
  const filteredFactors = useMemo(() => {
    if (!yearFilter) return allFactors;
    return allFactors.filter(f => f.year === parseInt(yearFilter));
  }, [allFactors, yearFilter]);

  // Best factor for this country + reporting year
  const bestFactor = useMemo(() => {
    return getBestFactor({ category, country: countryFilter || detectedCountry, reportingYear });
  }, [category, countryFilter, detectedCountry, reportingYear]);

  // Available countries and years for this category
  const availableCountries = useMemo(() => getCountriesForCategory(category), [category]);
  const availableYears = useMemo(() => getYearsForCategory(category, countryFilter), [category, countryFilter]);

  // Currency + inflation adjustment (for spend-based)
  const adjustment = useMemo(() => {
    if (!selectedFactorId || category !== "spend_based") return null;
    const factor = allFactors.find(f => f.id === selectedFactorId);
    if (!factor || !factor.currency) return null;
    return adjustSpendForFactor(parseFloat(spendAmount) || 0, spendCurrency, factor, reportingYear);
  }, [selectedFactorId, allFactors, spendAmount, spendCurrency, reportingYear, category]);

  const handleSelect = (factor) => {
    // Compute adjustment inline to avoid stale state timing issues
    let adj = null;
    if (factor && factor.currency && (category === "spend_based" || factor.currency !== spendCurrency)) {
      adj = adjustSpendForFactor(parseFloat(spendAmount) || 0, spendCurrency, factor, reportingYear);
    }
    onSelect?.(factor, adj);
  };

  const handleNoData = (flagged) => {
    onNoData?.(flagged);
    if (flagged) onSelect?.(null, null);
  };

  const saveCustomFactor = async () => {
    if (!customForm.factor_name || !customForm.value || !customForm.unit) return;
    setSavingCustom(true);
    const created = await base44.entities.CustomEmissionFactor.create({
      ...customForm,
      category,
      country: customForm.country || detectedCountry,
      year: parseInt(customForm.year) || reportingYear,
      value: parseFloat(customForm.value),
      quality_tier: parseInt(customForm.quality_tier) || 3,
      is_active: true,
    });
    setCustomFactors(cf => [...cf, created]);
    setCustomForm({ factor_name: "", country: "", year: reportingYear, value: "", unit: "", source: "", justification: "", quality_tier: 3 });
    setShowCustomForm(false);
    setSavingCustom(false);
    // Auto-select the new custom factor
    handleSelect({ ...created, id: `custom-${created.id}`, isCustom: true, qualityTier: created.quality_tier || 3 });
  };

  const selectedFactor = allFactors.find(f => f.id === selectedFactorId);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header / Status Bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {noDataFlagged ? (
            <><Ban className="w-4 h-4 text-red-500" /><span className="text-sm font-semibold text-red-600">No Data Available — Flagged</span></>
          ) : selectedFactor ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-700">{selectedFactor.name}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{selectedFactor.value} {selectedFactor.unit}</span>
              {selectedFactor.id === bestFactor?.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">★ Best Match</span>}
              {selectedFactor.isCustom && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Custom</span>}
            </>
          ) : (
            <><AlertCircle className="w-4 h-4 text-amber-500" /><span className="text-sm font-semibold text-amber-600">Select an emission factor</span></>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Facility Location Info */}
          {locationId && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Facility location: <strong>{locations?.find(l => l.id === locationId)?.name || "—"}</strong> → Auto-applying <strong>{detectedCountry}</strong> emission factors</span>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-600">Filter by Country</Label>
              <Select value={countryFilter || detectedCountry} onValueChange={setCountryFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableCountries.map(c => <SelectItem key={c} value={c}>{c === detectedCountry ? `${c} (Facility)` : c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600">Filter by Year</Label>
              <Select value={yearFilter || "all"} onValueChange={v => setYearFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* No Data Flag */}
          <label className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100/50 transition-colors">
            <input type="checkbox" checked={noDataFlagged} onChange={e => handleNoData(e.target.checked)} className="mt-0.5 w-4 h-4 accent-red-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-red-700 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" /> Flag as "No Data Available"
              </div>
              <div className="text-xs text-red-600 mt-0.5">Use this when no emission factor exists for this activity. The entry will be saved with zero emissions and flagged for follow-up.</div>
            </div>
          </label>

          {/* Available Factors */}
          {!noDataFlagged && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Available Emission Factors ({filteredFactors.length})</span>
                {bestFactor && <span className="text-blue-600 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Best match highlighted</span>}
              </div>

              {filteredFactors.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  No factors found for {countryFilter} {yearFilter && `· ${yearFilter}`}. Try different filters or add a custom factor below.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {filteredFactors.map(f => {
                    const isBest = bestFactor && f.id === bestFactor.id;
                    const isSelected = f.id === selectedFactorId;
                    const tierInfo = getQualityTierLabel(f.qualityTier);
                    return (
                      <label
                        key={f.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border ${isSelected ? "bg-blue-50 border-blue-300" : isBest ? "bg-blue-50/30 border-blue-100 hover:bg-blue-50" : "border-slate-100 hover:bg-slate-50"}`}
                      >
                        <input type="radio" name="ef-select" checked={isSelected} onChange={() => handleSelect(f)} className="mt-0.5 accent-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{f.name}</span>
                            {isBest && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">★ Best</span>}
                            {f.isCustom && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Custom</span>}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${tierInfo.color}`}>{tierInfo.label}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <strong>{f.value} {f.unit}</strong> · {f.country} · {f.year} · {f.source}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Currency + Inflation Adjustment (for spend-based) */}
          {!noDataFlagged && adjustment && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
              <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Currency & Inflation Adjustment
              </div>
              <div className="text-xs text-amber-700 space-y-0.5">
                <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {adjustment.note}</div>
                <div>Adjusted spend for calculation: <strong>{adjustment.adjustedSpend.toFixed(2)} {selectedFactor?.currency}</strong></div>
              </div>
            </div>
          )}

          {/* Custom EF Entry */}
          {!noDataFlagged && (
            <div className="border-t border-slate-100 pt-3">
              {!showCustomForm ? (
                <Button variant="outline" size="sm" onClick={() => setShowCustomForm(true)} className="gap-1.5 text-xs w-full">
                  <Plus className="w-3.5 h-3.5" /> Add Custom Emission Factor
                </Button>
              ) : (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
                  <div className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Custom Emission Factor (saved for reuse + audit trail)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Factor Name *</Label>
                      <Input className="mt-1 h-8 text-xs" placeholder="e.g. Supplier-specific EF" value={customForm.factor_name} onChange={e => setCustomForm(f => ({ ...f, factor_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Country</Label>
                      <Input className="mt-1 h-8 text-xs" placeholder={detectedCountry} value={customForm.country} onChange={e => setCustomForm(f => ({ ...f, country: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Value *</Label>
                      <Input type="number" className="mt-1 h-8 text-xs" placeholder="0.00" value={customForm.value} onChange={e => setCustomForm(f => ({ ...f, value: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Unit *</Label>
                      <Input className="mt-1 h-8 text-xs" placeholder="kgCO2e/kWh" value={customForm.unit} onChange={e => setCustomForm(f => ({ ...f, unit: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Year</Label>
                      <Input type="number" className="mt-1 h-8 text-xs" value={customForm.year} onChange={e => setCustomForm(f => ({ ...f, year: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Source / Reference</Label>
                      <Input className="mt-1 h-8 text-xs" placeholder="e.g. Supplier EPD, internal study" value={customForm.source} onChange={e => setCustomForm(f => ({ ...f, source: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Quality Tier</Label>
                      <Select value={String(customForm.quality_tier)} onValueChange={v => setCustomForm(f => ({ ...f, quality_tier: parseInt(v) }))}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(QUALITY_TIER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label} — {v.desc}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Justification (audit trail)</Label>
                    <textarea className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs min-h-[40px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Why this factor? What data is it based on?" value={customForm.justification} onChange={e => setCustomForm(f => ({ ...f, justification: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowCustomForm(false)}>Cancel</Button>
                    <Button size="sm" onClick={saveCustomFactor} disabled={savingCustom || !customForm.factor_name || !customForm.value || !customForm.unit}>
                      {savingCustom ? "Saving..." : "Save & Use Factor"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}