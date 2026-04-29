import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const IRO_TYPE_CONFIG = {
  impact_positive: { label: "Positive Impact", color: "bg-emerald-100 text-emerald-700" },
  impact_negative: { label: "Negative Impact", color: "bg-red-100 text-red-600" },
  risk: { label: "Risk", color: "bg-orange-100 text-orange-700" },
  opportunity: { label: "Opportunity", color: "bg-blue-100 text-blue-700" },
};

function ScoreCell({ value, onChange, min = 1, max = 5, disabled = false }) {
  return (
    <input
      type="number" min={min} max={max} step="0.5"
      value={value || ""}
      disabled={disabled}
      onChange={e => onChange(parseFloat(e.target.value) || null)}
      className={`w-16 h-8 text-center text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 ${disabled ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "bg-white border-slate-200 hover:border-blue-300"}`}
    />
  );
}

function MaterialityBadge({ level }) {
  const cfg = {
    highly_material: "bg-red-100 text-red-700 border-red-200",
    material: "bg-orange-100 text-orange-700 border-orange-200",
    potentially_material: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low_materiality: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const labels = {
    highly_material: "⭐⭐⭐ Highly Material",
    material: "⭐⭐ Material",
    potentially_material: "⭐ Potentially Material",
    low_materiality: "Low Materiality",
  };
  if (!level) return null;
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg[level] || cfg.low_materiality}`}>{labels[level] || level}</span>;
}

function calcMaterialityLevel(score) {
  if (!score) return null;
  if (score >= 4) return "highly_material";
  if (score >= 3) return "material";
  if (score >= 2) return "potentially_material";
  return "low_materiality";
}

export default function Phase5Scoring({ assessment, onUpdate }) {
  const [iros, setIros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isDouble = assessment.materiality_approach === "double_materiality";
  const isFinancial = assessment.materiality_approach !== "single_impact";
  const isImpact = assessment.materiality_approach !== "single_financial";

  useEffect(() => {
    base44.entities.IRORegister.filter({ assessment_id: assessment.id }).then(data => {
      setIros(data);
      setLoading(false);
    });
  }, [assessment.id]);

  const updateScore = async (id, field, value) => {
    const iro = iros.find(i => i.id === id);
    const updates = { ...iro, [field]: value };

    // Recalculate severity
    const sevScale = field === "severity_scale" ? value : (iro.severity_scale || 0);
    const sevScope = field === "severity_scope" ? value : (iro.severity_scope || 0);
    const sevRemed = field === "severity_remediability" ? value : (iro.severity_remediability || 0);
    const isPositive = updates.iro_type === "impact_positive";
    const severity = isPositive ? Math.max(sevScale, sevScope) : Math.max(sevScale, sevScope, sevRemed);
    updates.severity_value = severity || null;

    // Recalculate impact score
    const likelihood = field === "likelihood_score" ? value : (iro.likelihood_score || 0);
    const stakeholderInput = field === "stakeholder_input_score" ? value : (iro.stakeholder_input_score || 0);
    const isActual = updates.status === "actual";

    let impactScore = null;
    if (severity > 0) {
      if (isActual && stakeholderInput > 0) impactScore = (severity + stakeholderInput) / 2;
      else if (isActual) impactScore = severity;
      else if (!isActual && likelihood > 0 && stakeholderInput > 0) impactScore = (severity + likelihood + stakeholderInput) / 3;
      else if (!isActual && likelihood > 0) impactScore = (severity + likelihood) / 2;
      else if (stakeholderInput > 0) impactScore = (severity + stakeholderInput) / 2;
      else impactScore = severity;
    }
    updates.impact_score = impactScore ? parseFloat(impactScore.toFixed(3)) : null;

    // Recalculate financial score
    const finMag = field === "financial_magnitude_score" ? value : (iro.financial_magnitude_score || 0);
    const finLik = field === "financial_likelihood_score" ? value : (iro.financial_likelihood_score || 0);
    const financialScore = finMag > 0 && finLik > 0 ? (finMag + finLik) / 2 : (finMag > 0 ? finMag : null);
    updates.financial_score = financialScore ? parseFloat(financialScore.toFixed(3)) : null;

    // Composite score
    let compositeScore = null;
    if (isDouble && impactScore && financialScore) compositeScore = (impactScore + financialScore) / 2;
    else if (isImpact && !isDouble) compositeScore = impactScore;
    else if (isFinancial && !isDouble) compositeScore = financialScore;
    updates.composite_score = compositeScore ? parseFloat(compositeScore.toFixed(3)) : null;
    updates.materiality_level = calcMaterialityLevel(compositeScore);

    await base44.entities.IRORegister.update(id, updates);
    setIros(is => is.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const handleNext = async () => {
    setSaving(true);
    const upd = await base44.entities.MaterialityAssessment.update(assessment.id, {
      current_phase: Math.max(assessment.current_phase || 1, 6),
    });
    onUpdate(upd);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Phase 5: Scoring Matrix</h2>
        <p className="text-sm text-slate-500 mt-1">Score each IRO on severity, likelihood, and financial dimensions. Scores auto-calculate (1–5 scale).</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
        <div><strong>Impact Score</strong> = (Severity + Likelihood + Stakeholder Input) / 3 [omitting unavailable components]</div>
        {isDouble && <div><strong>Composite Score</strong> = (Impact Score + Financial Score) / 2</div>}
        <div><strong>Thresholds:</strong> ≥4.0 Highly Material · ≥3.0 Material · ≥2.0 Potentially Material</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 min-w-[180px]">IRO Topic</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 w-24">Type</th>
              {isImpact && <>
                <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600" colSpan={4}>── Impact Assessment ──</th>
              </>}
              {isFinancial && <>
                <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600" colSpan={3}>── Financial ──</th>
              </>}
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600">Result</th>
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th></th><th></th>
              {isImpact && <>
                <th className="text-center px-2 py-1.5">Scale</th>
                <th className="text-center px-2 py-1.5">Scope</th>
                <th className="text-center px-2 py-1.5">Remed.</th>
                <th className="text-center px-2 py-1.5">Likelihood</th>
              </>}
              {isFinancial && <>
                <th className="text-center px-2 py-1.5">Magnitude</th>
                <th className="text-center px-2 py-1.5">Likelihood</th>
                <th className="text-center px-2 py-1.5">Fin. Score</th>
              </>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {iros.map(iro => {
              const isPositive = iro.iro_type === "impact_positive";
              const isActual = iro.status === "actual";
              return (
                <tr key={iro.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900 text-xs">{iro.topic_name}</div>
                    {iro.esrs_reference && <div className="text-xs text-purple-500 mt-0.5">{iro.esrs_reference}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${IRO_TYPE_CONFIG[iro.iro_type]?.color || "bg-slate-100 text-slate-600"}`}>
                      {IRO_TYPE_CONFIG[iro.iro_type]?.label || iro.iro_type}
                    </span>
                  </td>
                  {isImpact && <>
                    <td className="px-2 py-2.5 text-center">
                      <ScoreCell value={iro.severity_scale} onChange={v => updateScore(iro.id, "severity_scale", v)} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <ScoreCell value={iro.severity_scope} onChange={v => updateScore(iro.id, "severity_scope", v)} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <ScoreCell value={iro.severity_remediability} onChange={v => updateScore(iro.id, "severity_remediability", v)} disabled={isPositive} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <ScoreCell value={iro.likelihood_score} onChange={v => updateScore(iro.id, "likelihood_score", v)} disabled={isActual} />
                    </td>
                  </>}
                  {isFinancial && <>
                    <td className="px-2 py-2.5 text-center">
                      <ScoreCell value={iro.financial_magnitude_score} onChange={v => updateScore(iro.id, "financial_magnitude_score", v)} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <ScoreCell value={iro.financial_likelihood_score} onChange={v => updateScore(iro.id, "financial_likelihood_score", v)} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-xs font-bold ${iro.financial_score >= 4 ? "text-red-600" : iro.financial_score >= 3 ? "text-orange-600" : "text-slate-600"}`}>
                        {iro.financial_score?.toFixed(2) || "—"}
                      </span>
                    </td>
                  </>}
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm font-bold ${iro.composite_score >= 4 ? "text-red-600" : iro.composite_score >= 3 ? "text-orange-600" : iro.composite_score >= 2 ? "text-yellow-600" : "text-slate-400"}`}>
                        {iro.composite_score?.toFixed(2) || iro.impact_score?.toFixed(2) || "—"}
                      </span>
                      <MaterialityBadge level={iro.materiality_level} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleNext} disabled={saving}>
          {saving ? "Saving..." : "Continue to Phase 6: Matrix & Sign-off →"}
        </Button>
      </div>
    </div>
  );
}