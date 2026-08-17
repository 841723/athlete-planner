import { useEffect, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminPrompts } from "@/hooks/use-admin";
import { createAdminPrompt, updateAdminPrompt, deleteAdminPrompt } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { DefaultPrompt } from "@/types/session";

export function AdminPrompts() {
  const { data: prompts, isLoading } = useAdminPrompts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, { name: string; content: string }>>({});
  const [newPrompts, setNewPrompts] = useState<{ id: string; name: string; content: string }[]>([]);
  const [newCounter, setNewCounter] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "prompts"] });
  };

  useEffect(() => {
    if (!prompts) return;
    setEdits((e) => {
      const next = { ...e };
      for (const p of prompts) {
        if (!next[p.id]) next[p.id] = { name: p.name, content: p.content };
      }
      return next;
    });
  }, [prompts]);

  function toggleExpanded(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  function valueFor(p: DefaultPrompt) {
    return edits[p.id] ?? { name: p.name, content: p.content };
  }

  function patchEdit(id: string, patch: Partial<{ name: string; content: string }>) {
    setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? { name: "", content: "" }), ...patch } }));
  }

  async function handleSave(p: DefaultPrompt) {
    const val = valueFor(p);
    if (!val.name.trim() || !val.content.trim()) {
      toast({ type: "error", title: "Nombre y contenido son obligatorios" });
      return;
    }
    setSavingId(p.id);
    try {
      await updateAdminPrompt(p.id, { name: val.name, content: val.content });
      invalidate();
      toast({ type: "success", title: "Prompt por defecto guardado" });
    } catch (err) {
      toast({ type: "error", title: "No se pudo guardar", description: (err as Error).message });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(p: DefaultPrompt) {
    if (!window.confirm(`¿Eliminar el prompt «${p.name}» por defecto?`)) return;
    try {
      await deleteAdminPrompt(p.id);
      invalidate();
      toast({ type: "success", title: "Prompt eliminado" });
    } catch (err) {
      toast({ type: "error", title: "No se pudo eliminar", description: (err as Error).message });
    }
  }

  async function handleCreate(np: { id: string; name: string; content: string }) {
    if (!np.name.trim() || !np.content.trim()) {
      toast({ type: "error", title: "Nombre y contenido son obligatorios" });
      return;
    }
    setCreating(true);
    try {
      await createAdminPrompt({ name: np.name, content: np.content });
      setNewPrompts((ns) => ns.filter((n) => n.id !== np.id));
      invalidate();
      toast({ type: "success", title: "Prompt por defecto creado" });
    } catch (err) {
      toast({ type: "error", title: "No se pudo crear", description: (err as Error).message });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4" /> Prompts por defecto
        </h2>
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => {
            setNewPrompts((n) => [...n, { id: `new-${newCounter}`, name: "", content: "" }]);
            setNewCounter((c) => c + 1);
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo prompt
        </Button>
      </div>

      <p className="text-xs text-gray-500 bg-dark-400/40 rounded-lg p-3 mb-4">
        Plantilla global de prompts predefinidos (objetivo del atleta). Los cambios
        se propagan automáticamente a <strong>todos</strong> los atletas, tanto existentes
        como los que se creen después.
      </p>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="space-y-3">
          {prompts?.map((p) => {
            const val = valueFor(p);
            const dirty = val.name !== p.name || val.content !== p.content;
            return (
              <div key={p.id} className="p-3 rounded-xl bg-dark-300/50 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 text-left shrink-0"
                    onClick={() => toggleExpanded(p.id)}
                    title={expanded[p.id] ? "Ocultar contenido" : "Ver contenido"}
                  >
                    {expanded[p.id] ? (
                      <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0 text-gray-500" />
                    )}
                  </button>
                  <input
                    className="input w-full min-w-0 flex-1 py-1.5 text-sm sm:w-auto"
                    value={val.name}
                    onChange={(e) => patchEdit(p.id, { name: e.target.value })}
                  />
                  <span className="text-xs text-gray-500 truncate max-w-[14rem] hidden sm:block">
                    {!expanded[p.id] && val.content.trim()}
                  </span>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-400 hover:text-red-300 shrink-0"
                    onClick={() => handleDelete(p)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    className="text-xs px-2 py-1 shrink-0"
                    onClick={() => handleSave(p)}
                    disabled={!dirty || savingId === p.id}
                  >
                    {savingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Guardar
                  </Button>
                </div>
                {expanded[p.id] && (
                  <AutoTextarea
                    className="input w-full font-mono text-xs"
                    minRows={7}
                    value={val.content}
                    onChange={(e) => patchEdit(p.id, { content: e.target.value })}
                    spellCheck={false}
                  />
                )}
              </div>
            );
          })}
          {newPrompts.map((np) => (
            <div key={np.id} className="p-3 rounded-xl bg-dark-300/50 space-y-2 border border-accent/40">
              <div className="text-[10px] font-semibold text-accent uppercase tracking-wide">Nuevo prompt por defecto</div>
              <input
                className="input w-full py-1.5 text-sm"
                placeholder="Nombre del prompt"
                value={np.name}
                onChange={(e) =>
                  setNewPrompts((ns) => ns.map((n) => (n.id === np.id ? { ...n, name: e.target.value } : n)))
                }
              />
              <AutoTextarea
                className="input w-full font-mono text-xs"
                minRows={7}
                placeholder="Contenido del prompt..."
                value={np.content}
                onChange={(e) =>
                  setNewPrompts((ns) => ns.map((n) => (n.id === np.id ? { ...n, content: e.target.value } : n)))
                }
                spellCheck={false}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                  onClick={() => setNewPrompts((ns) => ns.filter((n) => n.id !== np.id))}
                >
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
                <Button
                  className="text-xs px-2 py-1"
                  onClick={() => handleCreate(np)}
                  disabled={creating}
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Crear
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
