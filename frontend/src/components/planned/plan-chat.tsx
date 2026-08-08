import { useState } from "react";
import { Bot, Send, Loader2, Lock, RefreshCw, User } from "lucide-react";
import { format } from "@/lib/date-format";
import { usePlanChat, useSendPlanChat } from "@/hooks/use-plan-chat";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Plan } from "@/types/session";

interface PlanChatProps {
  plan: Plan;
}

export function PlanChat({ plan }: PlanChatProps) {
  const perms = usePermissions();
  const { data, isLoading } = usePlanChat(plan.id, true);
  const sendMutation = useSendPlanChat();
  const [draft, setDraft] = useState("");

  const canChat = perms.canEdit && !!data?.canChat;
  const expiresAt = data?.planCreatedAt
    ? new Date(new Date(data.planCreatedAt).getTime() + 24 * 60 * 60 * 1000)
    : null;

  function handleSend() {
    const message = draft.trim();
    if (!message || sendMutation.isPending) return;
    sendMutation.mutate({ planId: plan.id, message });
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-dark-400 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-dark-300/50 border-b border-dark-400">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-light">
          <Bot className="w-3.5 h-3.5" />
          Chat con el entrenador IA
          {data && !data.canChat && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-dark-400/60 text-gray-400 text-[10px]">
              <Lock className="w-2.5 h-2.5" /> Caducado
            </span>
          )}
        </div>
        {expiresAt && data?.canChat && (
          <span className="text-[10px] text-gray-500">Expira {format(expiresAt, "d MMM HH:mm")}</span>
        )}
      </div>

      <div className="bg-dark-300/20 p-3 space-y-3 flex-1 overflow-y-auto min-h-[200px] max-h-[60vh]">
        {isLoading && (
          <>
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg w-3/4" />
          </>
        )}

        {!isLoading && data && data.messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-2">
            Pregunta al entrenador sobre tu plan: cambia sesiones, ajusta cargas o resuelve dudas.
          </p>
        )}

        {!isLoading &&
          data?.messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-accent/20 text-gray-100 rounded-br-sm"
                    : "bg-dark-400/60 text-gray-200 rounded-bl-sm"
                }`}
              >
                <div className="flex items-center gap-1 mb-1 text-[10px] text-gray-500">
                  {m.role === "assistant" ? (
                    <>
                      <Bot className="w-2.5 h-2.5" /> Entrenador
                    </>
                  ) : (
                    <>
                      <User className="w-2.5 h-2.5" /> Tú
                    </>
                  )}
                  <span>· {format(new Date(m.created_at), "HH:mm")}</span>
                </div>
                {m.content}
              </div>
            </div>
          ))}

        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm bg-dark-400/60 text-gray-400">
              <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1.5" />
              El entrenador está pensando...
            </div>
          </div>
        )}

        {sendMutation.isSuccess && sendMutation.data.sessionsUpdated > 0 && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
              <RefreshCw className="w-3 h-3" />
              Se actualizaron {sendMutation.data.sessionsUpdated} sesiones del plan
            </div>
          </div>
        )}
      </div>

      {canChat ? (
        <div className="flex gap-2 p-2 border-t border-dark-400">
          <input
            className="flex-1 rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
            placeholder="Ej: Cambia el rodaje del sábado a bici suave..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sendMutation.isPending}
          />
          <Button onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending}>
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      ) : (
        <div className="px-3 py-2.5 border-t border-dark-400 text-xs text-gray-500">
          {!perms.canEdit
            ? "Solo los usuarios con permisos de edición pueden chatear."
            : "El chat caducó a las 24 horas de generar el plan."}
        </div>
      )}
    </div>
  );
}
