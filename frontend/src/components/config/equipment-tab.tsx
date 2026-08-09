import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEquipment, useSaveEquipment } from "@/hooks/use-equipment";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { EquipmentCategory, EquipmentItem } from "@/types/session";

type AvailableMap = Record<string, string>;

export function EquipmentTab() {
  const { data, isLoading } = useEquipment();
  const saveMutation = useSaveEquipment();
  const perms = usePermissions();
  const canManage = perms.canManageUsers;

  const [available, setAvailable] = useState<AvailableMap>({});
  const [catalog, setCatalog] = useState<EquipmentCategory[]>([]);
  const [addItem, setAddItem] = useState<Record<string, string>>({});
  const [newCatName, setNewCatName] = useState("");
  const [orphans, setOrphans] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    const map: AvailableMap = {};
    for (const it of data.items) {
      map[it.item] = it.category;
    }
    setAvailable(map);
    setCatalog((data.catalog ?? []).map((c) => ({ ...c, items: [...c.items] })));
    const inCatalog = new Set((data.catalog ?? []).flatMap((c) => c.items.map((i) => i.label)));
    setOrphans(data.items.filter((it) => !inCatalog.has(it.item)).map((it) => it.item));
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  function toggleAvailable(item: string, category: string) {
    setAvailable((o) => {
      const next = { ...o };
      if (next[item]) {
        delete next[item];
      } else {
        next[item] = category;
      }
      return next;
    });
  }

  function removeItemFromCatalog(category: string, item: string) {
    setCatalog((cs) =>
      cs.map((c) =>
        c.category === category ? { ...c, items: c.items.filter((i) => i.label !== item) } : c
      )
    );
    setAvailable((o) => {
      const next = { ...o };
      delete next[item];
      return next;
    });
  }

  function removeCategory(category: string) {
    setCatalog((cs) => cs.filter((c) => c.category !== category));
    setAvailable((o) => {
      const next: AvailableMap = {};
      for (const [item, cat] of Object.entries(o)) {
        if (cat !== category) next[item] = cat;
      }
      return next;
    });
  }

  function addItemToCategory(category: string) {
    const label = (addItem[category] ?? "").trim();
    if (!label) return;
    const exists = catalog.some(
      (c) => c.category === category && c.items.some((i) => i.label === label)
    );
    if (exists) {
      setAddItem((a) => ({ ...a, [category]: "" }));
      return;
    }
    setCatalog((cs) =>
      cs.map((c) =>
        c.category === category ? { ...c, items: [...c.items, { id: `custom_${label}`, label, emoji: "" }] } : c
      )
    );
    setAddItem((a) => ({ ...a, [category]: "" }));
  }

  function addCategory() {
    const label = newCatName.trim();
    if (!label) return;
    const slug =
      label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || `custom_${Date.now()}`;
    setCatalog((cs) => [...cs, { category: slug, label, emoji: "", items: [] }]);
    setNewCatName("");
  }

  function handleSave() {
    const items: EquipmentItem[] = Object.entries(available).map(([item, category]) => ({
      item,
      category,
      quantity: 1,
    }));
    saveMutation.mutate({ items, catalog });
  }

  function renderRow(item: string, category: string) {
    const isAvailable = !!available[item];
    return (
      <div
        key={item}
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border text-sm transition-colors ${
          isAvailable
            ? "bg-accent/10 border-accent/40 text-gray-100"
            : "bg-dark-300/30 border-dark-400 text-gray-300"
        }`}
      >
        <span className="flex-1 min-w-0 truncate">{item}</span>
        {canManage ? (
          <>
            <button
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                isAvailable
                  ? "bg-accent/20 border-accent/40 text-accent-light"
                  : "bg-dark-400/60 border-dark-400 text-gray-500"
              }`}
              onClick={() => toggleAvailable(item, category)}
              aria-label={isAvailable ? `Marcar ${item} como no disponible` : `Marcar ${item} como disponible`}
            >
              {isAvailable ? "Disponible ✓" : "No disponible"}
            </button>
            <button
              className="w-6 h-6 rounded flex items-center justify-center bg-dark-400/60 text-red-400 hover:text-red-300"
              onClick={() => removeItemFromCatalog(category, item)}
              aria-label={`Quitar ${item} del material`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {catalog.map((cat: EquipmentCategory) => (
        <div key={cat.category} className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex-1">
              {cat.label}
            </h2>
            {canManage && (
              <button
                className="w-6 h-6 rounded flex items-center justify-center bg-dark-400/60 text-red-400 hover:text-red-300"
                onClick={() => removeCategory(cat.category)}
                aria-label={`Eliminar categoría ${cat.label}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {cat.items.length === 0 ? (
            <p className="text-xs text-gray-500 mb-3">Sin material. Añade algo abajo.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {cat.items.map((it) => renderRow(it.label, cat.category))}
            </div>
          )}
          {canManage && (
            <div className="flex gap-2">
              <input
                className="input flex-1 py-1.5 text-sm"
                placeholder={`Añadir material a ${cat.label.toLowerCase()}...`}
                value={addItem[cat.category] ?? ""}
                onChange={(e) => setAddItem((a) => ({ ...a, [cat.category]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItemToCategory(cat.category);
                }}
              />
              <Button onClick={() => addItemToCategory(cat.category)} disabled={!(addItem[cat.category] ?? "").trim()}>
                <Plus className="w-4 h-4" /> Añadir
              </Button>
            </div>
          )}
        </div>
      ))}

      {orphans.length > 0 ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Material sin categoría
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Este material no está en el catálogo. Puedes quitarlo o añadirlo a una categoría.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {orphans.map((label) => renderRow(label, "other"))}
          </div>
        </div>
      ) : null}

      {canManage && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Nueva categoría
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="input flex-1 py-1.5 text-sm"
              placeholder="Nombre de la categoría (ej. Ropa, Trail...)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
              }}
            />
            <Button onClick={addCategory} disabled={!newCatName.trim()}>
              <Plus className="w-4 h-4" /> Crear categoría
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Añade todo el material que tienes y marca como disponible aquel del que dispones para
        entrenar. El material disponible se envía al entrenador IA para que adapte las sesiones.
      </p>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar equipamiento
          </Button>
        </div>
      )}
    </div>
  );
}
