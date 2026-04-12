import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const ASSET_CLASSES = [
  { key: "listed_equity_bonds", label: "Listed Equity & Corporate Bonds", denominator: "EVIC (Enterprise Value incl. Cash)", catNum: 15 },
  { key: "business_loans_unlisted", label: "Business Loans & Unlisted Equity", denominator: "Total Equity + Debt", catNum: 15 },
  { key: "project_finance", label: "Project Finance", denominator: "Total Project Equity + Debt", catNum: 15 },
  { key: "cre_mortgages", label: "Commercial Real Estate & Mortgages", denominator: "Property Value at Origination", catNum: 15 },
  { key: "motor_vehicle_loans", label: "Motor Vehicle Loans", denominator: "Total Vehicle Value at Origination", catNum: 15 },
  { key: "uop_structures", label: "Use of Proceeds Structures (Green Bonds, Debt Funds)", denominator: "Total UoP Structure Equity + Debt", catNum: 15 },
  { key: "securitizations", label: "Securitizations & Structured Products (MBS, ABS, CLOs)", denominator: "Total Tranche Size", catNum: 15 },
  { key: "sovereign_debt", label: "Sovereign Debt", denominator: "PPP-Adjusted GDP", catNum: 15 },
  { key: "sub_sovereign_debt", label: "Sub-Sovereign Debt (States, Municipalities)", denominator: "Sub-Sovereign PPP-Adjusted GDP", catNum: 15 },
  { key: "facilitated_capital_markets", label: "Facilitated Emissions — Capital Markets", denominator: "EVIC or Total Equity + Debt", catNum: 15 },
];

const PCAF_QUALITY_LABELS = {
  1: "Score 1 — Verified reported data (highest)",
  2: "Score 2 — Unverified / primary energy data",
  3: "Score 3 — Physical activity proxies",
  4: "Score 4 — Economic/revenue proxies",
  5: "Score 5 — Generic estimates (lowest)",
};

const S3_QUALITY_LABELS = {
  1: "S3 Score 1 — Verified Scope 3 data",
  2: "S3 Score 2 — Unverified Scope 3 data",
  3: "S3 Score 3 — Physical activity estimate",
  4: "S3 Score 4 — EEIO / revenue estimate",
  5: "S3 Score 5 — Generic proxy",
};

function QualityBadge({ score }) {
  const cfg = score <= 2 ? "bg-amber-100 text-amber-700 border-amber-300" : score <= 3 ? "bg-slate-100 text-slate-600 border-slate-300" : score <= 4 ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-red-50 text-red-600 border-red-200";
  const label = score <= 2 ? "Gold" : score <= 3 ? "Silver" : score <= 4 ? "Bronze" : "Estimated";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{label} · Score {score}</span>;
}

export default function InvestmentsPCAFDialog({ open, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [assetClass, setAssetClass] = useState("listed_equity_bonds");
  const [form, setForm] = useState({
    investee_name: "", investee_sector: "Energy & Utilities", investee_country: "",
    outstanding_amount: "", evic: "", total_equity: "", total_debt: "",
    property_value: "", vehicle_value: "",
    s1s2_tco2e: "", s3_tco2e: "", include_s3: false,
    pcaf_s1s2_score: "3", pcaf_s3_score: "4",
    investee_revenue: "", physical_production: "",
    property_floor_area: "", metered_kwh: "",
    vehicle_fuel_litres: "", vehicle_distance_km: "",
    ppp_gdp: "", sovereign_emissions_tco2e: "",
    facilitated_amount: "",
    start_date: "", end_date: "", notes: "", status: "Draft",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const asset = ASSET_CLASSES.find(a => a.key === assetClass);
  const outstanding = parseFloat(form.outstanding_amount) || parseFloat(form.facilitated_amount) || 0;
  const evic = parseFloat(form.evic) || 0;
  const totalEq = parseFloat(form.total_equity) || 0;
  const totalDebt = parseFloat(form.total_debt) || 0;
  const ev = totalEq + totalDebt;
  const propVal = parseFloat(form.property_value) || 0;
  const vehicleVal = parseFloat(form.vehicle_value) || 0;
  const pppGdp = parseFloat(form.ppp_gdp) || 0;
  const s1s2 = parseFloat(form.s1s2_tco2e) || 0;
  const s3 = form.include_s3 ? (parseFloat(form.s3_tco2e) || 0) : 0;

  let attrFactor = 0;
  if (["listed_equity_bonds", "facilitated_capital_markets"].includes(assetClass)) {
    attrFactor = evic > 0 ? outstanding / evic : 0;
  } else if (["business_loans_unlisted", "project_finance", "uop_structures", "securitizations"].includes(assetClass)) {
    attrFactor = ev > 0 ? outstanding / ev : 0;
  } else if (["cre_mortgages"].includes(assetClass)) {
    attrFactor = propVal > 0 ? outstanding / propVal : 0;
  } else if (assetClass === "motor_vehicle_loans") {
    attrFactor = vehicleVal > 0 ? outstanding / vehicleVal : 0;
  } else if (["sovereign_debt", "sub_sovereign_debt"].includes(assetClass)) {
    attrFactor = pppGdp > 0 ? outstanding / pppGdp : 0;
  }

  // Facilitated = 33% weighting
  const isFacilitated = assetClass === "facilitated_capital_markets";
  const effectiveFactor = isFacilitated ? attrFactor * 0.33 : attrFactor;

  const s1s2_financed = s1s2 * effectiveFactor;
  const s3_financed = s3 * effectiveFactor;
  const total_financed = s1s2_financed + s3_financed;

  const save = async () => {
    setSaving(true);
    const denominator = evic || ev || propVal || vehicleVal || pppGdp || 0;
    await base44.entities.EmissionEntry.create({
      scope: "Scope 3", category: "Investments", s3_category_number: 15,
      sub_category: asset.label,
      source_name: form.investee_name,
      investee_company: form.investee_name,
      investee_sector: form.investee_sector,
      investee_country: form.investee_country,
      investment_value_usd: outstanding || undefined,
      total_equity_usd: totalEq || undefined,
      total_debt_usd: totalDebt || undefined,
      investee_revenue_usd: parseFloat(form.investee_revenue) || undefined,
      investee_s1s2_tco2e: s1s2 || undefined,
      investee_s3_tco2e: s3 || undefined,
      attribution_factor: parseFloat((effectiveFactor * 100).toFixed(4)),
      pcaf_data_quality: parseInt(form.pcaf_s1s2_score),
      financed_tco2e: parseFloat(total_financed.toFixed(6)),
      tco2e: parseFloat(total_financed.toFixed(6)),
      investment_type: asset.label,
      start_date: form.start_date, end_date: form.end_date,
      notes: [form.notes, `Asset class: ${asset.label}`, `Denominator: ${asset.denominator} = ${denominator.toLocaleString()}`, isFacilitated ? "Facilitated: 33% factor applied" : ""].filter(Boolean).join(" | "),
      status: form.status,
      reporting_year: 2024,
      calculation_method: `PCAF Standard — ${asset.label} — Score ${form.pcaf_s1s2_score}`,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  const showEVIC = ["listed_equity_bonds", "facilitated_capital_markets"].includes(assetClass);
  const showEquityDebt = ["business_loans_unlisted", "project_finance", "uop_structures", "securitizations"].includes(assetClass);
  const showPropVal = assetClass === "cre_mortgages";
  const showVehicle = assetClass === "motor_vehicle_loans";
  const showSovereign = ["sovereign_debt", "sub_sovereign_debt"].includes(assetClass);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Category 15 · PCAF Standard</div>
            <h2 className="text-lg font-bold text-slate-900">Add Investment — PCAF Financed Emissions</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* PCAF info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="text-xs font-semibold text-blue-800 mb-1">📐 PCAF Standard — 10 Asset Classes Supported</div>
            <p className="text-xs text-blue-700">Financed Emissions = Attribution Factor × Investee Emissions. Scope 1 & 2 and Scope 3 are scored <strong>independently</strong> (no averaging).</p>
          </div>

          {/* Asset Class */}
          <div>
            <Label className="text-sm font-medium">Asset Class</Label>
            <Select value={assetClass} onValueChange={setAssetClass}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSET_CLASSES.map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {asset && (
              <p className="text-xs text-slate-500 mt-1">Denominator: <strong>{asset.denominator}</strong>
                {isFacilitated && <span className="ml-2 text-amber-600 font-medium">· 33% facilitated weighting applied</span>}
              </p>
            )}
          </div>

          {/* Investee Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">{showSovereign ? "Country / Government Name" : "Investee / Company Name"}</Label>
              <Input className="mt-1" placeholder={showSovereign ? "e.g. Australia" : "Company or project name"} value={form.investee_name} onChange={e => set("investee_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Sector</Label>
              <Select value={form.investee_sector} onValueChange={v => set("investee_sector", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["Energy & Utilities","Financial Services","Technology","Healthcare","Consumer Goods","Industrials","Materials","Real Estate","Transportation","Agriculture","Government","Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Country</Label>
            <Input className="mt-1" placeholder="e.g. Australia" value={form.investee_country} onChange={e => set("investee_country", e.target.value)} />
          </div>

          {/* Attribution Inputs */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-700">Attribution Factor Inputs — {asset?.denominator}</div>
            <div>
              <Label className="text-sm font-medium">{isFacilitated ? "Facilitated Amount (USD)" : "Outstanding Amount (USD)"}</Label>
              <Input type="number" className="mt-1" placeholder="0" value={isFacilitated ? form.facilitated_amount : form.outstanding_amount}
                onChange={e => set(isFacilitated ? "facilitated_amount" : "outstanding_amount", e.target.value)} />
            </div>
            {showEVIC && (
              <div>
                <Label className="text-sm font-medium">EVIC — Enterprise Value Including Cash (USD)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.evic} onChange={e => set("evic", e.target.value)} />
              </div>
            )}
            {showEquityDebt && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Total Equity (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.total_equity} onChange={e => set("total_equity", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Debt (USD)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.total_debt} onChange={e => set("total_debt", e.target.value)} />
                </div>
              </div>
            )}
            {showPropVal && (
              <div>
                <Label className="text-sm font-medium">Property Value at Origination (USD)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.property_value} onChange={e => set("property_value", e.target.value)} />
              </div>
            )}
            {showVehicle && (
              <div>
                <Label className="text-sm font-medium">Total Vehicle Value at Origination (USD)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.vehicle_value} onChange={e => set("vehicle_value", e.target.value)} />
              </div>
            )}
            {showSovereign && (
              <div>
                <Label className="text-sm font-medium">PPP-Adjusted GDP (USD)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.ppp_gdp} onChange={e => set("ppp_gdp", e.target.value)} />
              </div>
            )}
            {effectiveFactor > 0 && (
              <div className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs">
                <span className="text-slate-500">Attribution Factor: </span>
                <span className="font-bold text-slate-800">{(attrFactor * 100).toFixed(3)}%</span>
                {isFacilitated && <span className="text-amber-600 ml-1">× 33% = <strong>{(effectiveFactor * 100).toFixed(3)}% effective</strong></span>}
              </div>
            )}
          </div>

          {/* Emissions Data — Scope 1+2 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-emerald-800">Investee Scope 1 & 2 Emissions</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Scope 1 + 2 (tCO₂e)</Label>
                <Input type="number" className="mt-1" placeholder="0" value={form.s1s2_tco2e} onChange={e => set("s1s2_tco2e", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium">PCAF Score — Scope 1+2</Label>
                <Select value={form.pcaf_s1s2_score} onValueChange={v => set("pcaf_s1s2_score", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PCAF_QUALITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Emissions Data — Scope 3 (separate score) */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-purple-800">Investee Scope 3 Emissions (Optional — Scored Independently)</div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.include_s3} onChange={e => set("include_s3", e.target.checked)} className="w-4 h-4 accent-purple-600" />
                <span className="text-xs text-slate-600">Include Scope 3</span>
              </label>
            </div>
            {form.include_s3 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Scope 3 (tCO₂e)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.s3_tco2e} onChange={e => set("s3_tco2e", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">PCAF Score — Scope 3</Label>
                  <Select value={form.pcaf_s3_score} onValueChange={v => set("pcaf_s3_score", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(S3_QUALITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {!form.include_s3 && (
              <p className="text-xs text-purple-600">PCAF mandates Scope 1+2 and Scope 3 are scored separately. No averaging is permitted. Enable above to add a separate Scope 3 data quality score.</p>
            )}
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
            <Input className="mt-1" placeholder="Data source, EVIC reference date..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Result */}
          {total_financed > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-medium">Financed Emissions (tCO₂e)</div>
                  <div className="text-2xl font-bold text-emerald-800">{total_financed.toFixed(4)} <span className="text-sm font-normal">tCO₂e</span></div>
                </div>
                <QualityBadge score={parseInt(form.pcaf_s1s2_score)} />
              </div>
              <div className="text-xs space-y-0.5 text-emerald-700">
                <div className="flex justify-between">
                  <span>Scope 1+2 Financed:</span>
                  <span className="font-semibold">{s1s2_financed.toFixed(4)} tCO₂e <QualityBadge score={parseInt(form.pcaf_s1s2_score)} /></span>
                </div>
                {form.include_s3 && (
                  <div className="flex justify-between items-center">
                    <span>Scope 3 Financed:</span>
                    <span className="font-semibold">{s3_financed.toFixed(4)} tCO₂e <QualityBadge score={parseInt(form.pcaf_s3_score)} /></span>
                  </div>
                )}
              </div>
              <button onClick={() => setShowAudit(a => !a)} className="flex items-center gap-1 text-xs text-emerald-600">
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showAudit ? "Hide" : "Show"} audit trail
              </button>
              {showAudit && (
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  <div><span className="font-semibold">Asset Class:</span> {asset.label}</div>
                  <div><span className="font-semibold">Denominator:</span> {asset.denominator}</div>
                  <div><span className="font-semibold">Attribution Factor:</span> {(attrFactor * 100).toFixed(3)}%{isFacilitated ? ` × 33% = ${(effectiveFactor * 100).toFixed(3)}% effective` : ""}</div>
                  <div><span className="font-semibold">S1+2 Quality Score:</span> {form.pcaf_s1s2_score}/5 (separate from Scope 3)</div>
                  {form.include_s3 && <div><span className="font-semibold">S3 Quality Score:</span> {form.pcaf_s3_score}/5 (independently scored)</div>}
                  <div className="text-slate-400">References: PCAF Standard 2022 · GHG Protocol Scope 3 Cat 15</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || total_financed === 0}>
            {saving ? "Saving..." : "Save Investment Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}