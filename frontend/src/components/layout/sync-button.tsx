import { Loader2, RefreshCw } from "lucide-react";
import { useGarminSync } from "@/hooks/use-garmin-sync";
import { SyncProgressModal } from "./sync-progress-modal";

export function SyncButton() {
  const mutation = useGarminSync();

  function handleSync() {
    if (mutation.isPending) return;
    mutation.mutate(undefined);
  }

  return (
    <>
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

      <SyncProgressModal
        open={mutation.isPending || mutation.isError}
        isPending={mutation.isPending}
        isSuccess={false}
        isError={mutation.isError}
        error={mutation.error}
        onClose={() => mutation.reset()}
      />
    </>
  );
}
