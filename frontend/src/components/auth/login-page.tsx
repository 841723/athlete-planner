import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./auth-context";
import { fetchAuthConfig } from "@/services/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function LoginPage() {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setClientId(cfg.clientId);
        if (!cfg.clientId) {
          setError("GOOGLE_CLIENT_ID no está configurado en el backend.");
          setLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("No se pudo contactar con el backend.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;

    const scriptId = "gsi-client";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const onReady = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            setLoading(true);
            await login(response.credential);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error al iniciar sesión");
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
      });
      setLoading(false);
    };

    if (script) {
      onReady();
      return;
    }
    script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = onReady;
    document.body.appendChild(script);
    return () => {
      // no remover: el script se reutiliza
    };
  }, [clientId, login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-50 p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-[#C8102E] text-2xl font-bold uppercase mb-2">Ironman 70.3</div>
        <p className="text-sm text-gray-400 mb-8">Inicia sesión con tu cuenta de Google</p>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        )}

        <div ref={buttonRef} className="flex justify-center" />

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
