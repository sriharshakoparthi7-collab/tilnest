import { useState } from "react";
import { X, CheckCircle2, AlertCircle, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUESTIONS = [
  {
    id: "q1",
    title: "Question 1 of 4 — Intermediate vs. Final Good Test",
    trigger: "Category 10 (Processing of Sold Products)",
    prompt: "Is this product sold to the end-consumer as a finished item, or is it sold to another business to be used as a component or ingredient in a different product?",
    options: [
      { key: "finished", label: "Finished Item", sub: "It is sold to the final user in its current state." },
      { key: "component", label: "Component / Ingredient", sub: "Another company will process, manufacture, or assemble it further." },
    ],
  },
  {
    id: "q2",
    title: "Question 2 of 4 — Direct Energy Test",
    trigger: "Category 11 (Use of Sold Products – Direct)",
    prompt: "Does this product require electricity or fuel to operate, or does it release gases during normal use?",
    options: [
      { key: "yes", label: "Yes", sub: "e.g., cars, electronics, servers, refrigerators, aerosol sprays." },
      { key: "no", label: "No", sub: "e.g., a wooden desk, a t-shirt, a standard hand tool." },
    ],
  },
  {
    id: "q3",
    title: "Question 3 of 4 — Indirect Energy Test",
    trigger: "Category 11 (Use of Sold Products – Indirect)",
    prompt: "Even though the product doesn't plug in or burn fuel, does its normal use force the consumer to use energy?",
    options: [
      { key: "yes", label: "Yes", sub: "e.g., apparel that requires hot-water washing, food that requires oven cooking." },
      { key: "no", label: "No", sub: "e.g., a wooden chair — no energy is required to use it." },
    ],
    showIf: (answers) => answers.q2 === "no",
  },
  {
    id: "q4",
    title: "Question 4 of 4 — Physical Waste Test",
    trigger: "Category 12 (End-of-Life Treatment of Sold Products)",
    prompt: "Is this a physical product, or does it come in physical packaging that the customer will eventually throw away or recycle?",
    options: [
      { key: "yes", label: "Yes, it is physical or has packaging", sub: "Triggers end-of-life emissions calculation." },
      { key: "no", label: "No, it is purely digital / zero physical footprint", sub: "e.g., SaaS subscription, digital consulting." },
    ],
  },
];

function deriveCategories(answers) {
  const cats = [];
  if (answers.q1 === "component") cats.push({ label: "Category 10 — Processing of Sold Products", scope: "Scope 3", category: "Processing of Sold Products", color: "blue" });
  if (answers.q2 === "yes") cats.push({ label: "Category 11 — Use of Sold Products (Direct)", scope: "Scope 3", category: "Use of Sold Products", color: "purple" });
  if (answers.q2 === "no" && answers.q3 === "yes") cats.push({ label: "Category 11 — Use of Sold Products (Indirect)", scope: "Scope 3", category: "Use of Sold Products", color: "purple" });
  if (answers.q4 === "yes") cats.push({ label: "Category 12 — End-of-Life Treatment", scope: "Scope 3", category: "End-of-Life Treatment of Sold Products", color: "orange" });
  return cats;
}

export default function ProductClassificationGateway({ open, onClose, onAddEntry }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);

  if (!open) return null;

  const visibleQuestions = QUESTIONS.filter(q => !q.showIf || q.showIf(answers));
  const current = visibleQuestions[step];
  const categories = deriveCategories(answers);

  const handleAnswer = (key) => {
    const newAnswers = { ...answers, [current.id]: key };
    setAnswers(newAnswers);
    const nextVisible = QUESTIONS.filter(q => !q.showIf || q.showIf(newAnswers));
    if (step + 1 < nextVisible.length) {
      setStep(step + 1);
    } else {
      setDone(true);
    }
  };

  const reset = () => { setStep(0); setAnswers({}); setDone(false); };

  const colorMap = { blue: "bg-blue-50 border-blue-200 text-blue-800", purple: "bg-purple-50 border-purple-200 text-purple-800", orange: "bg-orange-50 border-orange-200 text-orange-800" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Product Classification Gateway</h2>
            <p className="text-xs text-slate-500 mt-0.5">Determines which Scope 3 categories apply to your product</p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6">
          {!done ? (
            <div className="space-y-5">
              {/* Progress */}
              <div className="flex gap-1">
                {visibleQuestions.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`} />
                ))}
              </div>

              <div>
                <div className="text-xs font-semibold text-emerald-600 mb-1">{current.title}</div>
                <div className="text-xs text-slate-500 mb-1">Triggers: <span className="font-medium text-slate-700">{current.trigger}</span></div>
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{current.prompt}</p>
              </div>

              <div className="space-y-2">
                {current.options.map(opt => (
                  <button key={opt.key} onClick={() => handleAnswer(opt.key)}
                    className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Classification Complete</span>
                </div>
                <p className="text-xs text-emerald-700">Based on your answers, the following Scope 3 categories apply to this product. Add data entries for each applicable category.</p>
              </div>

              {categories.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">No downstream Scope 3 categories triggered. Only upstream (Cat 1/2) emissions apply.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map((cat) => (
                    <div key={cat.label} className={`p-4 rounded-xl border ${colorMap[cat.color]}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{cat.label}</div>
                          <div className="text-xs opacity-70 mt-0.5">{cat.scope}</div>
                        </div>
                        <Button size="sm" variant="outline" className="text-xs gap-1"
                          onClick={() => onAddEntry(cat.scope, cat.category)}>
                          <Plus className="w-3 h-3" /> Add Entry
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={reset}>Start Over</Button>
                <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}