import { useState, useEffect } from "react";
import { X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const PCAF_LABELS = {
  1: "Score 1 — Verified reported data (highest quality)",
  2: "Score 2 — Unverified reported data",
  3: "Score 3 — EEIO/revenue-based estimation",
  4: "Score 4 — Proxy sector-average data",
  5: "Score 5 — Physical activity / spend proxy (lowest quality)",
};

const SECTORS = [
  "Energy & Utilities","Financial Services","Technology","Healthcare","Consumer Goods",
  "Industrials","Materials","Real Estate","Transportation","Agriculture","Other"
];

const INVESTMENT_TYPES = [
  { key: "Equity", label: "Equity (Listed / Unlisted Shares)" },
  { key: "Debt (Corporate Bond)", label: "Debt — Corporate Bond / Loan" },
  { key: "Debt (Project Finance)", label: "Debt — Project Finance" },
  { key: "Managed Portfolio", label: "Managed Portfolio (Funds)" },
  { key: "Insurance (Underwriting)", label: "Insurance — Underwriting" },
];

function calcAttribution(type, form) {
  const inv = parseFloat(form.investment_value_usd) || 0;
  const eq = parseFloat(form.total_equity_usd) || 0;
  const debt = parseFloat(form.total_debt_usd) || 0;
  const ev = eq + debt;
  if (ev === 0) return 0;
  if (type === "Equity") return inv / eq;
  if (type === "Debt (Corporate Bond)" || type === "Debt (Project Finance)") return inv / ev;
  if (type === "Managed Portfolio") return inv / ev;
  if (type === "Insurance (Underwriting)") {
    const prem = parseFloat(form.insurance_premium_usd) || 0;
    const total = parseFloat(form.total_premium_portfolio_usd) || 1;
    return prem / total;
  }
  return 0;
}

export default function InvestmentsDialog({ open, onClose, onSaved, defaultValues = {} }) {
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [form, setForm] = useState({
    investment_type: "Equity",
    investee_company: "", investee_sector: "Other", investee_country: "",
    investment_value_usd: "", total_equity_usd: "", total_debt_usd: "",
    investee_revenue_usd: "",
    investee_s1s2_tco2e: "", investee_s3_tco2e: "",
    pcaf_data_quality: "3",
    include_scope3: false,
    insurance_premium_usd: "", total_premium_portfolio_usd: "",
    start_date: "", end_date: "", notes: "", status: "Draft",
    ...defaultValues
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { base44.entities.Location.list().then(setLocations); }, []);

  const attrFactor = calcAttribution(form.investment_type, form);
  const s1s2 = parseFloat(form.investee_s1s2_tco2e) || 0;
  const s3 = form.include_scope3 ? (parseFloat(form.investee_s3_tco2e) || 0) : 0;
  const total = s1s2 + s3;
  const financed = total * attrFactor;

  const save = async () => {
    setSaving(true);
    const data = {
      scope: "Scope 3", category: "Investments", s3_category_number: 15,
      source_name: form.investee_company,
      investment_type: form.investment_type,
      investee_company: form.investee_company,
      investee_sector: form.investee_sector,
      investee_country: form.investee_country,
      investment_value_usd: parseFloat(form.investment_value_usd) || undefined,
      total_equity_usd: parseFloat(form.total_equity_usd) || undefined,
      total_debt_usd: parseFloat(form.total_debt_usd) || undefined,
      investee_revenue_usd: parseFloat(form.investee_revenue_usd) || undefined,
      investee_s1s2_tco2e: s1s2 || undefined,
      investee_s3_tco2e: s3 || undefined,
      attribution_factor: parseFloat((attrFactor * 100).toFixed(4)),
      pcaf_data_quality: parseInt(form.pcaf_data_quality),
      insurance_premium_usd: parseFloat(form.insurance_premium_usd) || undefined,
      total_premium_portfolio_usd: parseFloat(form.total_premium_portfolio_usd) || undefined,
      financed_tco2e: parseFloat(financed.toFixed(6)),
      tco2e: parseFloat(financed.toFixed(6)),
      start_date: form.start_date, end_date: form.end_date,
      notes: form.notes, status: form.status,
      reporting_year: 2024,
      calculation_method: "Actual",
      data_quality_tier: `tier${form.pcaf_data_quality <= 2 ? 1 : form.pcaf_data_quality <= 3 ? 2 : 4}`,
      data_quality_score: Math.max(1, 10 - (parseInt(form.pcaf_data_quality) - 1) * 2),
    };
    if (defaultValues.id) await base44.entities.EmissionEntry.update(defaultValues.id, data);
    else await base44.entities.EmissionEntry.create(data);
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  const isInsurance = form.investment_type === "Insurance (Underwriting)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Category 15 · Investments</div>
            <h2 className="text-lg font-bold text-slate-900">{defaultValues.id ? "Edit Investment" : "Add Investment"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* PCAF banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="text-xs font-semibold text-blue-800 mb-1">📐 PCAF Standard (Partnership for Carbon Accounting Financials)</div>
            <p className="text-xs text-blue-700">Financed Emissions = Attribution Factor × (Investee Scope 1+2 + optional Scope 3). Attribution factor = Your investment ÷ Enterprise Value (or Equity, or Premium).</p>
          </div>

          {/* Investment type */}
          <div>
            <Label className="text-sm font-medium">Investment / Asset Type</Label>
            <div className="mt-1.5 space-y-2">
              {INVESTMENT_TYPES.map(t => (
                <label key={t.key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${form.investment_type === t.key ? "bg-blue-50 border-blue-300" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="inv_type" checked={form.investment_type === t.key} onChange={() => set("investment_type", t.key)} className="accent-blue-600" />
                  <span className="text-sm text-slate-800">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Investee details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Investee / Company Name</Label>
              <Input className="mt-1" placeholder="Company name" value={form.investee_company} onChange={e => set("investee_company", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Sector</Label>
              <Select value={form.investee_sector} onValueChange={v => set("investee_sector", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Country</Label>
            <Input className="mt-1" placeholder="e.g. Australia" value={form.investee_country} onChange={e => set("investee_country", e.target.value)} />
          </div>

          {/* Financial inputs */}
          {!isInsurance && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-700">Attribution Calculation Inputs</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Our Investment (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.investment_value_usd} onChange={e => set("investment_value_usd", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Investee Total Equity (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.total_equity_usd} onChange={e => set("total_equity_usd", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Investee Total Debt (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.total_debt_usd} onChange={e => set("total_debt_usd", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Investee Revenue (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.investee_revenue_usd} onChange={e => set("investee_revenue_usd", e.target.value)} />
                </div>
              </div>
              {attrFactor > 0 && (
                <div className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-500">Attribution Factor: </span>
                  <span className="font-bold text-slate-800">{(attrFactor * 100).toFixed(2)}%</span>
                  <span className="text-slate-400 ml-2">(Your Investment ÷ {form.investment_type === "Equity" ? "Equity" : "Enterprise Value"})</span>
                </div>
              )}
            </div>
          )}

          {isInsurance && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-700">Insurance Attribution Inputs</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Premium Written (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.insurance_premium_usd} onChange={e => set("insurance_premium_usd", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Premium Portfolio (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.total_premium_portfolio_usd} onChange={e => set("total_premium_portfolio_usd", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Emissions data */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-emerald-800">Investee Emissions Data</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Investee Scope 1+2 (tCO₂e)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.investee_s1s2_tco2e} onChange={e => set("investee_s1s2_tco2e", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">Investee Scope 3 (tCO₂e)</Label>
                <Input type="number" className="mt-1" placeholder="0 (optional)" value={form.investee_s3_tco2e} onChange={e => set("investee_s3_tco2e", e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.include_scope3} onChange={e => set("include_scope3", e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              <span className="text-xs text-slate-700">Include investee's Scope 3 in my financed emissions</span>
            </label>
          </div>

          {/* PCAF Data Quality */}
          <div>
            <Label className="text-sm font-medium">PCAF Data Quality Score</Label>
            <Select value={form.pcaf_data_quality} onValueChange={v => set("pcaf_data_quality", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PCAF_LABELS).map(([k, v]) => <SelectItem key={k} value={String(k)}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Reporting Start</Label>
              <Input type="date" className="mt-1" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Reporting End</Label>
              <Input type="date" className="mt-1" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <Input className="mt-1" placeholder="Data source, assumptions..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Result */}
          {financed > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs text-emerald-600 font-medium">Financed Emissions (tCO₂e)</div>
              <div className="text-2xl font-bold text-emerald-800">{financed.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
              <div className="text-xs text-emerald-700 mt-1">= {(attrFactor * 100).toFixed(2)}% × ({s1s2.toFixed(2)}{form.include_scope3 ? ` + ${s3.toFixed(2)} S3` : ""} tCO₂e)</div>
              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600 mt-2">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="mt-2 bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  <div><span className="font-semibold">Method:</span> PCAF Standard — {form.investment_type}</div>
                  <div><span className="font-semibold">Attribution:</span> ${(parseFloat(form.investment_value_usd)||0).toLocaleString()} ÷ ${((parseFloat(form.total_equity_usd)||0)+(parseFloat(form.total_debt_usd)||0)).toLocaleString()} = {(attrFactor*100).toFixed(2)}%</div>
                  <div><span className="font-semibold">Investee S1+2:</span> {s1s2} tCO₂e{form.include_scope3 ? `, S3: ${s3} tCO₂e` : ""}</div>
                  <div><span className="font-semibold">PCAF Quality:</span> Score {form.pcaf_data_quality}/5</div>
                  <div className="text-slate-400">Databases: PCAF Standard 2022 · GHG Protocol Scope 3 Cat 15</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || financed === 0}>
            {saving ? "Saving..." : "Save Investment Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}