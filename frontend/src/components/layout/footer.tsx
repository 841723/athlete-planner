import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";

function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(
        () => true,
        () => fallbackCopy(text)
      );
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function Footer() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(window.location.href);
    if (ok) {
      setCopied(true);
      toast({ type: "success", title: "URL copiada" });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ type: "error", title: "No se pudo copiar la URL" });
    }
  }

  return (
    <footer className="mt-10 pt-6 pb-4 border-t border-white/5 flex flex-col sm:flex-row items-center gap-4">
      <div className="flex items-center gap-2">
        <img src="/edasi-light-long.png" alt="edasi logo" className="h-6" />
      </div>
      <div className="flex-1" />
      <button
        onClick={handleCopy}
        className="flex md:hidden items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg bg-dark-300/40 hover:bg-dark-300 transition-colors"
        title="Copiar la URL actual (incluye el atleta y la página)"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-accent-light" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copiada" : "Copiar URL"}
      </button>
    </footer>
  );
}
