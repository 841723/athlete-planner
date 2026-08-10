import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const { normalizeModels } = await import("../lib/opencode.js");

test("normalizeModels mapea costes, filtros inválidos y marca enabled", () => {
  const raw = [
    {
      id: "model-a",
      providerID: "openai",
      name: "Modelo A",
      enabled: true,
      cost: [
        { input: 2.5, output: 10, tier: "prompt" },
        { input: 1, output: 4 },
      ],
    },
    { id: "model-b", name: "Modelo B", enabled: false },
    { id: "model-c", providerID: "anthropic", cost: [] },
    null,
    { noId: true },
  ];

  const models = normalizeModels(raw);
  assert.equal(models.length, 3);

  const a = models.find((m) => m.id === "model-a");
  // pickCost usa el tramo sin `tier` (la entrada base), no el de prompt.
  assert.equal(a.input_per_mtok, 1);
  assert.equal(a.output_per_mtok, 4);
  assert.equal(a.name, "Modelo A");
  assert.equal(a.providerID, "openai");
  assert.equal(a.enabled, true);

  const b = models.find((m) => m.id === "model-b");
  assert.equal(b.enabled, false);
  assert.equal(b.input_per_mtok, null);
  assert.equal(b.output_per_mtok, null);

  const c = models.find((m) => m.id === "model-c");
  assert.equal(c.input_per_mtok, null);
  assert.equal(c.output_per_mtok, null);
  assert.equal(c.name, "model-c", "name cae a id cuando no hay name");
});

test("normalizeModels acepta datos en data", () => {
  const models = normalizeModels({
    data: [{ id: "m", providerID: "openai", enabled: true }],
  });
  assert.equal(models.length, 1);
  assert.equal(models[0].id, "m");
});
