import { useState } from "react";
import { X, Building2, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";

export default function InvestmentsGateway({ open, onClose, onProceedPCAF, onControlledAsset }) {
  const [step, setStep] = useState("control"); // control | control_type | controlled_form
  const [controlType, setControlType] = useState("");
  const [form, setForm] = useState({ source_name: "", s1_tco2e: "", s2_tco2e: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const reset = () => { setStep("control"); setControlType(""); setForm({ source_name: "", s1_tco2e: "", s2_tco2e: "", notes: "" }); };

  const saveControlled = async () => {
    setSaving(true);
    const total = (parseFloat(form.s1_tco2e) || 0) + (parseFloat(form.s2_tco2e) || 0);
    await base44.entities.EmissionEntry.create({
      scope: controlType === "Operational Control" ? "Scope 1" : "Scope 2",
      category: "Controlled Investment Asset",
      source_name: form.source_name,
      tco2e: parseFloat(total.toFixed(6)),
      calculation_method: `Consolidated — ${controlType} (100% attribution)`,
      reporting_year: 2024,
      notes: `Controlled asset. ${controlType}. S1: ${form.s1_tco2e} tCO₂e, S2: ${form.s2_tco2e} tCO₂e. ${form.notes}`,
      status: "Draft",
    });
    setSaving(false);
    reset();
    onClose();
    if (onControlledAsset) onControlledAsset();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Scope 3 · Category 15 · Investments</div>
            <h2 className="text-lg font-bold text-slate-900">Investment Boundary Gateway</h2>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Control question */}
          {step === "control" && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-800 mb-1">Determine Investment Boundary (GHG Protocol)</div>
                <p className="text-xs text-blue-700">The GHG Protocol requires you to first determine whether your institution has a controlling interest in this asset. This determines whether emissions are reported as Scope 1/2 (controlled) or Scope 3 Cat 15 (financed).</p>
              </div>

              <h3 className="text-base font-semibold text-slate-800">Does your institution hold a controlling interest in this asset or company?</h3>

              <div className="space-y-3">
                <button onClick={() => setStep("control_type")}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700">Yes, we have control.</div>
                        <div className="text-xs text-slate-500 mt-0.5">We have the authority to dictate the financial policies or day-to-day operational policies of this asset.</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 flex-shrink-0" />
                  </div>
                </button>

                <button onClick={() => { reset(); onProceedPCAF(); }}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">No, we do not have control.</div>
                        <div className="text-xs text-slate-500 mt-0.5">We provide capital (e.g., a standard loan, minority equity) but do not dictate overarching financial or operational policies.</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Control type */}
          {step === "control_type" && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
                Because your institution has control, <strong>100% of this asset's Scope 1 and Scope 2 emissions</strong> will be consolidated into your institution's direct operational footprint — not reported as Scope 3 Category 15.
              </div>

              <h3 className="text-base font-semibold text-slate-800">Which type of control does your institution exercise?</h3>

              <div className="space-y-3">
                {[
                  { key: "Operational Control", label: "Operational Control", sub: "We have full authority over day-to-day physical operations of this asset.", scope: "Scope 1" },
                  { key: "Financial Control", label: "Financial Control", sub: "We retain the majority of financial risks/rewards and dictate financial policies.", scope: "Scope 1 & 2" },
                ].map(opt => (
                  <button key={opt.key} onClick={() => { setControlType(opt.key); setStep("controlled_form"); }}
                    className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-amber-700">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                        <div className="text-xs font-medium text-amber-600 mt-1">→ Adds to {opt.scope} inventory</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={() => setStep("control")} className="text-xs text-slate-400 hover:underline">← Back</button>
            </div>
          )}

          {/* Step 3: Enter controlled asset emissions */}
          {step === "controlled_form" && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800">
                <span className="font-semibold">✓ {controlType}</span> — 100% of this asset's emissions will be added to your Scope 1 & 2 inventory.
              </div>

              <div>
                <Label className="text-sm font-medium">Asset / Company Name</Label>
                <Input className="mt-1" placeholder="e.g. Subsidiary Pty Ltd" value={form.source_name} onChange={e => set("source_name", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Asset Scope 1 (tCO₂e)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.s1_tco2e} onChange={e => set("s1_tco2e", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Asset Scope 2 (tCO₂e)</Label>
                  <Input type="number" className="mt-1" placeholder="0" value={form.s2_tco2e} onChange={e => set("s2_tco2e", e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Notes</Label>
                <Input className="mt-1" placeholder="Data source, reporting year..." value={form.notes} onChange={e => set("notes", e.target.value)} />
              </div>

              {((parseFloat(form.s1_tco2e) || 0) + (parseFloat(form.s2_tco2e) || 0)) > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
                  <span className="text-slate-500">Total to consolidate: </span>
                  <span className="font-bold text-slate-800">{((parseFloat(form.s1_tco2e) || 0) + (parseFloat(form.s2_tco2e) || 0)).toFixed(3)} tCO₂e</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button onClick={() => setStep("control_type")} className="text-xs text-slate-400 hover:underline">← Back</button>
                <Button onClick={saveControlled} disabled={saving || !form.source_name}>
                  {saving ? "Saving..." : "Consolidate into Inventory"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {step === "control" && (
          <div className="flex justify-end p-6 border-t border-slate-100">
            <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}