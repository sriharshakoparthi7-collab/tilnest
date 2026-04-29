import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, CheckCircle2, Circle } from "lucide-react";
import Phase1CompanySetup from "@/components/materiality/Phase1CompanySetup";
import Phase2ValueChain from "@/components/materiality/Phase2ValueChain";
import Phase3Stakeholders from "@/components/materiality/Phase3Stakeholders";
import Phase4IRORegister from "@/components/materiality/Phase4IRORegister";
import Phase5Scoring from "@/components/materiality/Phase5Scoring";
import Phase6Matrix from "@/components/materiality/Phase6Matrix";

const PHASES = [
  { num: 1, label: "Company Setup" },
  { num: 2, label: "Value Chain" },
  { num: 3, label: "Stakeholders" },
  { num: 4, label: "IRO Register" },
  { num: 5, label: "Scoring" },
  { num: 6, label: "Matrix & Sign-Off" },
];

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  ready_for_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

export default function MaterialityDetail() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [activePhase, setActivePhase] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.MaterialityAssessment.filter({ id });
    if (data.length > 0) {
      setAssessment(data[0]);
      setActivePhase(data[0].current_phase || 1);
    }
    setLoading(false);
  };

  const handleUpdate = (updated) => {
    setAssessment(updated);
    setActivePhase(updated.current_phase || activePhase);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );

  if (!assessment) return (
    <div className="p-6 text-center text-slate-400">Assessment not found.</div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link to="/materiality" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
            <ChevronLeft className="w-4 h-4" /> Assessments
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 text-sm">{assessment.name}</span>
          <Badge className={`text-xs ml-1 ${STATUS_COLORS[assessment.status] || "bg-slate-100 text-slate-600"}`}>
            {assessment.status?.replace(/_/g, " ")}
          </Badge>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <span>{assessment.assessment_framework}</span>
            <span>·</span>
            <span>{assessment.materiality_approach?.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>{assessment.assessment_year}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Phase Sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-20">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <div className="text-xs font-semibold text-slate-600">Assessment Phases</div>
            </div>
            <div className="p-2">
              {PHASES.map(phase => {
                const isComplete = (assessment.current_phase || 1) > phase.num;
                const isCurrent = activePhase === phase.num;
                const isLocked = phase.num > (assessment.current_phase || 1);
                return (
                  <button
                    key={phase.num}
                    onClick={() => !isLocked && setActivePhase(phase.num)}
                    disabled={isLocked}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all mb-0.5 ${isCurrent ? "bg-blue-50 text-blue-800 font-medium" : isComplete ? "text-slate-600 hover:bg-slate-50" : isLocked ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isCurrent ? "border-blue-500" : "border-slate-300"}`}>
                        {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </div>
                    )}
                    <span className="text-xs leading-tight">{phase.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Phase Content */}
        <div className="flex-1 min-w-0">
          {activePhase === 1 && <Phase1CompanySetup assessment={assessment} onUpdate={handleUpdate} />}
          {activePhase === 2 && <Phase2ValueChain assessment={assessment} onUpdate={handleUpdate} />}
          {activePhase === 3 && <Phase3Stakeholders assessment={assessment} onUpdate={handleUpdate} />}
          {activePhase === 4 && <Phase4IRORegister assessment={assessment} onUpdate={handleUpdate} />}
          {activePhase === 5 && <Phase5Scoring assessment={assessment} onUpdate={handleUpdate} />}
          {activePhase === 6 && <Phase6Matrix assessment={assessment} onUpdate={handleUpdate} />}
        </div>
      </div>
    </div>
  );
}