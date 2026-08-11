import { useEffect, useState } from "react";
import { Brain, ChevronDown, ChevronRight, Loader2, Plus, Save, Trash2, XCircle } from "lucide-react";
import { usePrompts, useSavePrompt, useUpdatePrompt, useDeletePrompt } from "@/hooks/use-prompts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { AiPrompt } from "@/types/session";

export function PromptsTab() {
  const { data: prompts, isLoading } = usePrompts();
  const saveMutation = useSavePrompt();
  const updateMutation = useUpdatePrompt();
  const deleteMutation = useDeletePrompt();
  const [edits, setEdits] = useState<Record<string, { name: string; content: string }>>({});
  const [newPrompts, setNewPrompts] = useState<{ id: string; name: string; content: string }[]>([]);
  const [newCounter, setNewCounter] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleExpanded(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

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

  function valueFor(p: AiPrompt) {
    return edits[p.id] ?? { name: p.name, content: p.content };
  }

  function patchEdit(id: string, patch: Partial<{ name: string; content: string }>) {
    setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? { name: "", content: "" }), ...patch } }));
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4" /> Prompts de IA
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
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="space-y-3">
          {prompts?.map((p) => {
            const val = valueFor(p);
            const predefined = !!p.is_predefined;
            const dirty = val.name !== p.name || val.content !== p.content;
            return (
              <div key={p.id} className="p-3 rounded-xl bg-dark-300/50 space-y-2">
                <div className="flex items-center gap-2">
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
                  {predefined ? (
                    <span className="text-sm font-medium text-gray-300 truncate min-w-0">{p.name}</span>
                  ) : (
                    <input
                      className="input flex-1 py-1.5 text-sm min-w-0"
                      value={val.name}
                      onChange={(e) => patchEdit(p.id, { name: e.target.value })}
                    />
                  )}
                  {predefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-dark-400/50 text-gray-400 shrink-0">
                      Predefinido
                    </span>
                  )}
                  <span className="text-xs text-gray-500 truncate max-w-[12rem] hidden sm:block">
                    {!expanded[p.id] && val.content.trim()}
                  </span>
                  <CopyButton text={val.content} title="Copiar contenido del prompt" className="shrink-0 ml-auto" />
                </div>
                {expanded[p.id] && (
                  <>
                    <AutoTextarea
                      className="input w-full font-mono text-xs"
                      minRows={7}
                      value={val.content}
                      onChange={(e) => !predefined && patchEdit(p.id, { content: e.target.value })}
                      spellCheck={false}
                      readOnly={predefined}
                    />
                    {!predefined && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                          onClick={() => deleteMutation.mutate(p.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          className="text-xs px-2 py-1"
                          onClick={() => updateMutation.mutate({ promptId: p.id, payload: { name: val.name, content: val.content } })}
                          disabled={!dirty || updateMutation.isPending}
                        >
                          {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Guardar
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {newPrompts.map((np) => (
            <div key={np.id} className="p-3 rounded-xl bg-dark-300/50 space-y-2 border border-accent/40">
              <div className="text-[10px] font-semibold text-accent uppercase tracking-wide">Nuevo prompt</div>
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
                  onClick={() => {
                    saveMutation.mutate({ name: np.name, content: np.content }, {
                      onSuccess: () => setNewPrompts((ns) => ns.filter((n) => n.id !== np.id)),
                    });
                  }}
                  disabled={saveMutation.isPending || !np.name.trim() || !np.content.trim()}
                >
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Crear
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-500">
            Los prompts predefinidos son de solo lectura. Los personalizados puedes editarlos y usarlos al generar un plan.
          </p>
        </div>
      )}
    </div>
  );
}
