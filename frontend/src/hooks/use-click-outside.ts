import { useEffect, type RefObject } from "react";

// Cierra un desplegable cuando se hace clic (o toque) en cualquier punto fuera
// del elemento referenciado. Complementa a los backdrops de los componentes:
// estos bloquean el "click-through" sobre el contenido, y este hook garantiza
// el cierre incluso sobre elementos que estén por encima del backdrop (p. ej.
// toasts con z-index mayor).
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
) {
  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (el.contains(target)) return;
      onOutside();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [ref, onOutside]);
}
