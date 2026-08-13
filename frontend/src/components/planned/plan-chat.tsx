import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  MessageCircle,
  Send,
  User,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { format } from "@/lib/date-format";
import { usePlanChat, useSendPlanChat, useCancelPlanChat, planChatKey, CHAT_INVALIDATE } from "@/hooks/use-plan-chat";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";
import type { Plan } from "@/types/session";

export function PlanChat({ plan }: { plan: Plan }) {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = usePlanChat(plan.id, true);
  const sendMutation = useSendPlanChat();
  const cancelMutation = useCancelPlanChat();
  const [draft, setDraft] = useState("");
  const [showLatest, setShowLatest] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);
  const previousMessageCount = useRef(0);
  const wasPending = useRef(false);
  const completionHandled = useRef(false);
  const cancelRequested = useRef(false);

  const canChat = permissions.canEdit && Boolean(data?.canChat);
  const coachWriting = sendMutation.isPending || Boolean(data?.chatPending);

  function scrollToLatest(smooth = false) {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });

    shouldStickToBottom.current = true;
    setShowLatest(false);
  }

  useEffect(() => {
    const messageCount = data?.messages.length ?? 0;

    if (messageCount > 0 && previousMessageCount.current === 0) {
      requestAnimationFrame(() => scrollToLatest());
    }

    if (messageCount > previousMessageCount.current && shouldStickToBottom.current) {
      requestAnimationFrame(() => scrollToLatest(true));
    }

    previousMessageCount.current = messageCount;
  }, [data?.messages.length]);

  // Cuando el plan vuelve a una respuesta pendiente a completada (por polling o
  // por recarga), avisamos y refrescamos los datos que el entrenador pudo
  // modificar (sesiones planificadas, semana, gráficas).
  useEffect(() => {
    const pending = Boolean(data?.chatPending);

    if (pending) {
      wasPending.current = true;
      completionHandled.current = false;
      return;
    }

    if (wasPending.current && !completionHandled.current) {
      completionHandled.current = true;
      wasPending.current = false;
      if (cancelRequested.current) {
        cancelRequested.current = false;
        toast({ type: "success", title: "Respuesta cancelada" });
      } else {
        toast({ type: "success", title: "El entrenador ha respondido" });
      }
      void queryClient.invalidateQueries({ queryKey: planChatKey(plan.id) });
      invalidateMany(queryClient, CHAT_INVALIDATE);
      void queryClient.invalidateQueries({ queryKey: ["plan-detail"] });
    } else if (!pending && !wasPending.current) {
      cancelRequested.current = false;
    }
  }, [data?.chatPending, data?.messages.length, plan.id, queryClient, toast]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;

    shouldStickToBottom.current = isNearBottom;
    setShowLatest(!isNearBottom && container.scrollHeight > container.clientHeight);
  }

  function handleSend() {
    const message = draft.trim();
    if (!message || sendMutation.isPending) return;

    shouldStickToBottom.current = true;
    sendMutation.mutate({ planId: plan.id, message });
    setDraft("");
  }

  function handleCancel() {
    if (cancelMutation.isPending) return;
    cancelRequested.current = true;
    cancelMutation.mutate({ planId: plan.id });
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-dark-400 bg-dark-200/60 shadow-lg">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15">
            <MessageCircle className="h-4 w-4 text-accent-light" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Chat con el entrenador</span>
            <span className="block text-[11px] text-gray-500">
              {data?.messages.length ?? 0} mensajes · profundiza en tu plan
            </span>
          </span>
        </span>
      </div>

      <div className="border-t border-dark-400">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative max-h-[60vh] min-h-[18rem] space-y-4 overflow-y-auto bg-dark-300/10 p-4 sm:p-6"
          >
            {isLoading && (
              <>
                <Skeleton className="h-14 w-2/3 rounded-xl" />
                <Skeleton className="ml-auto h-14 w-1/2 rounded-xl" />
              </>
            )}

            {!isLoading && data?.messages.length === 0 && (
              <div className="py-12 text-center">
                <Bot className="mx-auto mb-2 h-7 w-7 text-accent" />
                <p className="text-sm text-gray-400">
                  Pregunta al entrenador sobre tus sesiones, cargas o ajustes.
                </p>
              </div>
            )}

            {data?.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(48rem,88%)] rounded-2xl px-4 py-3 ${message.role === "user" ? "rounded-br-sm bg-accent/20" : "rounded-bl-sm bg-dark-400/60"}`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
                    {message.role === "assistant" ? (
                      <>
                        <Bot className="h-3 w-3" /> Entrenador
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" /> Tú
                      </>
                    )}
                    <span>
                      · {format(new Date(message.created_at), "HH:mm")}
                      {message.localStatus === "sending" && " · Enviando"}
                      {message.localStatus === "failed" && " · No se pudo completar"}
                    </span>
                  </div>

                  {message.role === "assistant" ? (
                    <Markdown text={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-gray-100">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {coachWriting && (
              <div className="flex items-center gap-2">
                <div className="rounded-2xl rounded-bl-sm bg-dark-400/60 px-4 py-3 text-sm text-gray-400">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  El entrenador está escribiendo...
                </div>
                {data?.chatPending && canChat && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-dark-300 hover:text-red-300"
                    title="Cancelar la respuesta del entrenador"
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Cancelar
                  </button>
                )}
              </div>
            )}

            {showLatest && (
              <button
                type="button"
                className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-lg"
                onClick={() => scrollToLatest(true)}
              >
                Ver mensajes recientes
              </button>
            )}
          </div>

          {canChat ? (
            <div className="border-t border-dark-400 p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  className="input min-h-10 max-h-32 flex-1 resize-y"
                  placeholder="Escribe una pregunta sobre tu plan..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sendMutation.isPending}
                />
                <Button
                  className="h-10 shrink-0"
                  onClick={handleSend}
                  disabled={!draft.trim() || sendMutation.isPending}
                  aria-label="Enviar mensaje"
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-gray-600">Enter para enviar · Shift + Enter para saltar de línea</p>
            </div>
          ) : (
            <div className="border-t border-dark-400 px-4 py-3 text-xs text-gray-500">
              {!permissions.canEdit
                ? "Solo los usuarios con permisos de edición pueden chatear."
                : "El chat estará disponible cuando el plan esté completo."}
            </div>
          )}
      </div>
    </div>
  );
}
