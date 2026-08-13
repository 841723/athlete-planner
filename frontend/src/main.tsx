import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/auth/auth-context";
import { AuthGate } from "@/components/auth/auth-gate";
import { ToastProvider } from "@/components/ui/toast";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Push is optional and must not prevent the application from loading.
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // La app es de un solo usuario y los datos cambian a menudo (sesiones,
      // chat del entrenador): queremos ver siempre lo último sin tener
      // que recargar la página, así que se refetchea en cada montaje y al
      // volver a la ventana aunque la caché esté "fresca".
      refetchOnMount: "always",
      refetchOnWindowFocus: "always",
      refetchOnReconnect: true,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AuthGate>
              <App />
            </AuthGate>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
