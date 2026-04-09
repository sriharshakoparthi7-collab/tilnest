import { useState } from "react";
import { X, Upload, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkUploadModal({ open, onClose, title, templateHeaders, onUpload, exampleRows = [] }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // null | "uploading" | "done" | "error"
  const [results, setResults] = useState(null);

  if (!open) return null;

  const downloadTemplate = () => {
    const rows = [templateHeaders.join(","), ...exampleRows.map(r => r.join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/ /g, "_")}_template.csv`;
    a.click();
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setStatus(null);
    setResults(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setStatus("uploading");
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim());
      return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || "" }), {});
    });
    const res = await onUpload(rows);
    setResults(res);
    setStatus(res.errors?.length > 0 ? "error" : "done");
  };

  const reset = () => { setFile(null); setStatus(null); setResults(null); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Bulk Upload — {title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <div>
              <div className="text-sm font-medium text-slate-800">Download CSV Template</div>
              <div className="text-xs text-slate-500">{templateHeaders.length} columns · includes example rows</div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Template
            </Button>
          </div>

          {/* Drop zone */}
          {status !== "done" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragging ? "border-emerald-400 bg-emerald-50" : file ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50 hover:border-slate-400"}`}
              onClick={() => document.getElementById("bulk-file-input").click()}
            >
              <input id="bulk-file-input" type="file" accept=".csv,.xlsx" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              {file ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <div className="text-sm font-medium text-slate-800">{file.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB · click to change</div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="text-sm text-slate-600">Drag & drop your CSV here or <span className="text-emerald-600 font-medium">browse</span></div>
                  <div className="text-xs text-slate-400 mt-1">CSV or XLSX · max 10MB</div>
                </>
              )}
            </div>
          )}

          {/* Results */}
          {status === "done" && results && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Upload complete</span>
              </div>
              <div className="text-sm text-emerald-700">{results.created} records created successfully</div>
              {results.skipped > 0 && <div className="text-xs text-amber-600 mt-1">{results.skipped} rows skipped (missing required fields)</div>}
            </div>
          )}

          {status === "error" && results?.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-h-40 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-red-700">Some rows had errors</span>
              </div>
              {results.errors.slice(0, 8).map((e, i) => (
                <div key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-5 border-t border-slate-100">
          <Button variant="ghost" onClick={status === "done" ? () => { reset(); onClose(); } : onClose}>
            {status === "done" ? "Close" : "Cancel"}
          </Button>
          {status === "done" ? (
            <Button variant="outline" onClick={reset}>Upload another</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!file || status === "uploading"} className="gap-2">
              {status === "uploading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : "Upload & Import"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}