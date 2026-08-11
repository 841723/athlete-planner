import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { useUpdatePlanned } from "@/hooks/use-planned";
import { formatTrainingDay, getSportColor, getSportLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { PlannedSessionView } from "@/types/session";

interface SessionTextModalProps {
  session: PlannedSessionView;
  onClose: () => void;
}

export function SessionTextModal({ session, onClose }: SessionTextModalProps) {
  const updateMutation = useUpdatePlanned();
  const [text, setText] = useState(session.workout_text ?? "");

  function insertTab(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const next = text.slice(0, start) + "\t" + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = start + 1;
    });
  }

  function handleSave() {
    updateMutation.mutate(
      { id: session.id, payload: { workout_text: text } },
      { onSuccess: onClose }
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: getSportColor(session.category) }}
            />
            <h3 className="text-lg font-bold truncate">{session.title ?? session.name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500 -mt-2 mb-4">
          {getSportLabel(session.category)} · {formatTrainingDay(session.start_date_local, session.weekNumber)}
        </p>

        <label className="block text-xs text-gray-400 mb-1.5">Texto del entrenamiento</label>
        <AutoTextarea
          className="input w-full font-mono text-[13px] leading-relaxed"
          minRows={14}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={insertTab}
          spellCheck={false}
          placeholder="Describe el trabajo a realizar (usa Tab para indentar)..."
        />
        <p className="mt-1 text-[10px] text-gray-600">Tab inserta un tabulador · los saltos de línea e indentación se conservan</p>

        <div className="flex gap-2 justify-end pt-4 border-t border-dark-400 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}