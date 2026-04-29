import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

const FRAMEWORK_INFO = {
  ESRS: { desc: "European Sustainability Reporting Standard — mandatory for large EU companies. Requires double materiality.", color: "border-purple-300 bg-purple-50" },
  GRI: { desc: "Global Reporting Initiative — widely used globally. Focuses on impact materiality.", color: "border-green-300 bg-green-50" },
  ISSB: { desc: "International Sustainability Standards Board (IFRS S1/S2) — investor-focused financial materiality.", color: "border-blue-300 bg-blue-50" },
};

const APPROACH_INFO = {
  double_materiality: { label: "Double Materiality", desc: "Assess both: how sustainability issues affect the company (financial) AND how the company affects society/environment (impact).", required: ["ESRS"] },
  single_impact: { label: "Impact Materiality Only", desc: "Focuses on how the company's activities impact people and the environment.", required: ["GRI"] },
  single_financial: { label: "Financial Materiality Only", desc: "Focuses on sustainability risks and opportunities that affect the company's financial performance.", required: ["ISSB"] },
};

export default function Phase1CompanySetup({ assessment, onUpdate }) {
  const [form, setForm] = useState({
    company_name: assessment.company_name || "",
    assessment_year: assessment.assessment_year || new Date().getFullYear(),
    country: assessment.country || "",
    industry_description: assessment.industry_description || "",
    industry_code: assessment.industry_code || "",
    assessment_framework: assessment.assessment_framework || "ESRS",
    materiality_approach: assessment.materiality_approach || "double_materiality",
    is_manual_industry_override: assessment.is_manual_industry_override || false,
  });
  const [classifying, setClassifying] = useState(false);
  const [nlpResult, setNlpResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const classifyIndustry = async () => {
    if (!form.industry_description) return;
    setClassifying(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an industry classification expert. Given the following company description, provide the best matching GICS and NACE industry codes with confidence score.

Company description: "${form.industry_description}"
Country: "${form.country}"

Respond with JSON only:
{
  "gics_code": "e.g. 1510",
  "gics_name": "e.g. Chemicals",
  "nace_code": "e.g. C20",
  "nace_name": "e.g. Manufacture of chemicals",
  "confidence_score": 0.92,
  "recommended_framework": "ESRS or GRI or ISSB",
  "rationale": "one sentence explanation"
}`,
      response_json_schema: {
        type: "object",
        properties: {
          gics_code: { type: "string" },
          gics_name: { type: "string" },
          nace_code: { type: "string" },
          nace_name: { type: "string" },
          confidence_score: { type: "number" },
          recommended_framework: { type: "string" },
          rationale: { type: "string" }
        }
      }
    });
    setNlpResult(res);
    setClassifying(false);
  };

  const acceptNlpResult = () => {
    if (!nlpResult) return;
    set("industry_code", `GICS ${nlpResult.gics_code} / NACE ${nlpResult.nace_code}`);
    set("is_manual_industry_override", false);
  };

  const save = async () => {
    setSaving(true);
    const updated = await base44.entities.MaterialityAssessment.update(assessment.id, {
      ...form,
      industry_confidence: nlpResult?.confidence_score,
      current_phase: Math.max(assessment.current_phase || 1, 2),
      status: "in_progress",
    });
    onUpdate(updated);
    setSaving(false);
  };

  const frameworkInfo = FRAMEWORK_INFO[form.assessment_framework];
  const approachInfo = APPROACH_INFO[form.materiality_approach];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Phase 1: Company Setup & Materiality Approach</h2>
        <p className="text-sm text-slate-500 mt-1">Define your organization profile and select the materiality framework for this assessment.</p>
      </div>

      {/* Company Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Company Details</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm">Company Name *</Label>
            <Input className="mt-1" value={form.company_name} onChange={e => set("company_name", e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">Assessment Year *</Label>
            <Input type="number" className="mt-1" value={form.assessment_year} onChange={e => set("assessment_year", parseInt(e.target.value))} />
          </div>
        </div>
        <div>
          <Label className="text-sm">Country / Region</Label>
          <Input className="mt-1" placeholder="e.g. Germany, Australia" value={form.country} onChange={e => set("country", e.target.value)} />
        </div>
      </div>

      {/* Industry Classification */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Industry Classification</div>
        <div>
          <Label className="text-sm">Describe your industry / business activities</Label>
          <textarea
            className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="e.g. We manufacture specialty chemicals for the automotive industry, with operations in Germany and supply chains across Southeast Asia..."
            value={form.industry_description}
            onChange={e => set("industry_description", e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={classifyIndustry} disabled={classifying || !form.industry_description} className="gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            {classifying ? "Classifying..." : "AI Auto-Classify"}
          </Button>
          <div className="flex-1">
            <Input placeholder="Or enter GICS/NACE code manually" value={form.industry_code} onChange={e => { set("industry_code", e.target.value); set("is_manual_industry_override", true); }} />
          </div>
        </div>

        {nlpResult && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">AI Classification Result</span>
              <span className="text-xs text-indigo-600 ml-auto">Confidence: {(nlpResult.confidence_score * 100).toFixed(0)}%</span>
            </div>
            <div className="text-xs text-indigo-700 space-y-0.5">
              <div><strong>GICS:</strong> {nlpResult.gics_code} — {nlpResult.gics_name}</div>
              <div><strong>NACE:</strong> {nlpResult.nace_code} — {nlpResult.nace_name}</div>
              <div className="text-indigo-500 mt-1">{nlpResult.rationale}</div>
            </div>
            <Button size="sm" onClick={acceptNlpResult} className="text-xs h-7">Accept Classification</Button>
          </div>
        )}

        {form.industry_code && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Industry Code: <strong>{form.industry_code}</strong>
            {form.is_manual_industry_override && <span className="text-amber-600">(Manual Override)</span>}
          </div>
        )}
      </div>

      {/* Framework Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Assessment Framework</div>
        <div className="space-y-2">
          {Object.entries(FRAMEWORK_INFO).map(([fw, info]) => (
            <label key={fw} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.assessment_framework === fw ? info.color + " border-2" : "border-slate-200 hover:bg-slate-50"}`}>
              <input type="radio" name="framework" value={fw} checked={form.assessment_framework === fw} onChange={() => set("assessment_framework", fw)} className="mt-0.5 accent-blue-600" />
              <div>
                <div className="font-medium text-sm text-slate-900">{fw}</div>
                <div className="text-xs text-slate-500 mt-0.5">{info.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Materiality Approach */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Materiality Approach</div>
        {form.assessment_framework === "ESRS" && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            ESRS requires Double Materiality for listed companies and large organizations.
          </div>
        )}
        <div className="space-y-2">
          {Object.entries(APPROACH_INFO).map(([key, info]) => (
            <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.materiality_approach === key ? "border-blue-300 bg-blue-50 border-2" : "border-slate-200 hover:bg-slate-50"}`}>
              <input type="radio" name="approach" value={key} checked={form.materiality_approach === key} onChange={() => set("materiality_approach", key)} className="mt-0.5 accent-blue-600" />
              <div>
                <div className="font-medium text-sm text-slate-900">{info.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{info.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !form.company_name}>
          {saving ? "Saving..." : "Save & Continue to Phase 2 →"}
        </Button>
      </div>
    </div>
  );
}