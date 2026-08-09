import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, X, XCircle } from "lucide-react";
import type { SyncResult } from "@/types/session";

const STEPS = [
  "Conectando con Garmin Connect",
  "Listando actividades",
  "Detectando sesiones pendientes",
  "Descargando el detalle de cada sesión",
  "Guardando en la base de datos",
  "Finalizando",
];

interface SyncProgressModalProps {
  open: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  data?: SyncResult;
  error?: Error | null;
  onClose: () => void;
}

export function SyncProgressModal({ open, isPending, isSuccess, isError, data, error, onClose }: SyncProgressModalProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setActiveStep(0);
    if (!isPending) return;
    const interval = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 900);
    return () => clearInterval(interval);
  }, [open, isPending]);

  if (!open) return null;

  const done = isSuccess || isError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-dark-400 bg-dark-200 p-5 animate-scale-in">
        <div className="flex items-start justify-between gap-2 mb-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : isError ? (
              <XCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-accent-light" />
            )}
            {isSuccess
              ? "Sincronización completada"
              : isError
                ? "Error al sincronizar"
                : "Sincronizando con Garmin"}
          </h4>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {STEPS.map((step, i) => {
            const isActive = isPending && i === activeStep;
            const isComplete = (isPending && i < activeStep) || isSuccess;
            return (
              <div
                key={step}
                className={`flex items-center gap-2.5 text-sm transition-colors ${
                  isActive
                    ? "text-accent-light"
                    : isComplete
                      ? "text-gray-400"
                      : isError
                        ? "text-gray-600"
                        : "text-gray-600"
                }`}
              >
                {isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500/70 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-dark-400 shrink-0" />
                )}
                <span className={isComplete ? "line-through opacity-70" : ""}>{step}</span>
              </div>
            );
          })}
        </div>

        {isSuccess && data && (
          <div className="rounded-xl bg-dark-300/50 p-3">
            {data.message && <p className="text-xs text-gray-300 mb-2">{data.message}</p>}
            <div className="flex gap-4 text-xs text-gray-400">
              <span>
                <span className="font-semibold text-white">{data.synced}</span> sincronizadas
              </span>
              <span>
                <span className="font-semibold text-white">{data.skipped}</span> omitidas
              </span>
              <span>
                <span className="font-semibold text-white">{data.missing}</span> sin detalles
              </span>
            </div>
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-400 whitespace-pre-wrap rounded-xl bg-dark-300/50 p-3">
            {error?.message ?? "Ha ocurrido un error inesperado."}
          </p>
        )}

        {done && (
          <div className="flex justify-end mt-4">
            <button className="btn btn-primary px-4 py-2 text-sm" onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
