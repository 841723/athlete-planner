import { useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { useGarminSync } from "@/hooks/use-garmin-sync";

export function SyncButton() {
  const mutation = useGarminSync();
  const [open, setOpen] = useState(false);

  function handleSync() {
    if (mutation.isPending) return;
    setOpen(true);
    mutation.mutate(undefined, {
      onSuccess: () => setOpen(true),
      onError: () => setOpen(true),
    });
  }

  return (
    <div className="relative">
      <button
        className="btn btn-primary px-3 sm:px-4 py-2 text-sm"
        onClick={handleSync}
        disabled={mutation.isPending}
        title="Sincronizar con Garmin"
      >
        {mutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {mutation.isPending ? "Sincronizando..." : "Sincronizar"}
        </span>
      </button>

      {open && (mutation.isSuccess || mutation.isError) && (
        <div className="absolute right-0 top-full mt-2 w-72 z-50">
          <div className="card p-4 animate-scale-in">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="text-sm font-semibold">
                {mutation.isSuccess ? "Sincronización completada" : "Error al sincronizar"}
              </h4>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {mutation.isSuccess ? (
              <div className="space-y-1.5 text-sm">
                {mutation.data.message && <p className="text-gray-300">{mutation.data.message}</p>}
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>
                    <span className="font-semibold text-white">{mutation.data.synced}</span>{" "}
                    sincronizadas
                  </span>
                  <span>
                    <span className="font-semibold text-white">{mutation.data.skipped}</span>{" "}
                    omitidas
                  </span>
                  <span>
                    <span className="font-semibold text-white">{mutation.data.missing}</span>{" "}
                    sin detalles
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-400 whitespace-pre-wrap">
                {mutation.error?.message ?? "Ha ocurrido un error inesperado."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
