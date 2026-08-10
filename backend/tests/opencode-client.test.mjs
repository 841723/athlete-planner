import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const { listModels, runConversation } = await import("../lib/opencode.js");

const MODEL_RAW = {
  data: [
    { id: "model-a", providerID: "openai", name: "Modelo A", enabled: true, cost: [{ input: 1, output: 4 }] },
    { id: "model-b", name: "Modelo B", enabled: false },
  ],
};

function createMockServer({ deadSession = null, onRequest } = {}) {
  const requests = [];
  let counter = 0;
  const served = new Map(); // sessionId -> nº de respuestas de assistant ya servidas
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    req.resume();
    req.on("end", () => {
      const key = `${req.method} ${url.pathname}`;
      requests.push(key);
      onRequest?.(key);

      if (req.method === "GET" && url.pathname === "/api/model") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(MODEL_RAW));
      }
      if (req.method === "POST" && url.pathname === "/api/session") {
        counter += 1;
        const sid = `s${counter}`;
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ data: { id: sid } }));
      }
      const pm = url.pathname.match(/^\/api\/session\/([^/]+)\/prompt$/);
      if (req.method === "POST" && pm) {
        if (pm[1] === deadSession) {
          res.writeHead(404);
          return res.end();
        }
        res.writeHead(204);
        return res.end();
      }
      const mm = url.pathname.match(/^\/api\/session\/([^/]+)\/message$/);
      if (req.method === "GET" && mm) {
        const sid = mm[1];
        const asked = served.get(sid) ?? 0;
        served.set(sid, asked + 1);
        const msgs =
          asked === 0
            ? [
                { type: "user", content: [{ type: "text", text: "hola" }] },
                {
                  type: "assistant",
                  finish: "stop",
                  time: { created: 1, completed: 2 },
                  content: [{ type: "text", text: "respuesta de prueba" }],
                  tokens: { input: 100, output: 50 },
                },
              ]
            : [{ type: "user", content: [] }];
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(msgs));
      }
      res.writeHead(404);
      res.end("{}");
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, requests }));
  });
}

function baseUrlOf(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

test("listModels obtiene y normaliza los modelos de opencode", async () => {
  const { server } = await createMockServer();
  try {
    const models = await listModels(baseUrlOf(server));
    assert.equal(models.length, 2);
    assert.equal(models.find((m) => m.id === "model-a").input_per_mtok, 1);
    assert.equal(models.find((m) => m.id === "model-b").enabled, false);
  } finally {
    server.close();
  }
});

test("runConversation crea sesión, envía prompt y lee la respuesta", async () => {
  const { server, requests } = await createMockServer();
  try {
    const result = await runConversation({
      baseUrl: baseUrlOf(server),
      modelId: "model-a",
      modelProviderId: "openai",
      systemPrompt: "Sistema",
      input: "Pregunta",
    });
    assert.equal(result.text, "respuesta de prueba");
    assert.equal(result.responseId, "s1");
    assert.deepEqual(result.usage, { input_tokens: 100, output_tokens: 50 });
    assert.ok(requests.includes("POST /api/session"));
    assert.ok(requests.includes("POST /api/session/s1/prompt"));
    assert.ok(requests.includes("GET /api/session/s1/message"), "lee el mensaje del asistente");
  } finally {
    server.close();
  }
});

test("runConversation sondea hasta que la respuesta del asistente está completa", async () => {
  // La primera lectura devuelve un mensaje de asistente sin terminar (sin
  // finish ni time.completed); el sondeo debe esperar a que se complete.
  const delays = new Map();
  const { server, requests } = await createMockServer({});
  // Sobrescribe el comportamiento de /message: primera llamada incompleta.
  const orig = server.listeners("request")[0];
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const mm = url.pathname.match(/^\/api\/session\/([^/]+)\/message$/);
    if (req.method === "GET" && mm) {
      const asked = delays.get(mm[1]) ?? 0;
      delays.set(mm[1], asked + 1);
      const msgs =
        asked === 0
          ? [{ type: "assistant", content: [{ type: "text", text: "mitad" }] }]
          : [
              {
                type: "assistant",
                finish: "stop",
                time: { created: 1, completed: 2 },
                content: [{ type: "text", text: "respuesta final" }],
                tokens: { input: 5, output: 3 },
              },
            ];
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(msgs));
    }
    orig(req, res);
  });
  try {
    const result = await runConversation({
      baseUrl: baseUrlOf(server),
      modelId: "model-a",
      modelProviderId: "openai",
      systemPrompt: "",
      input: "pregunta",
    });
    assert.equal(result.text, "respuesta final");
    assert.ok(delays.get("s1") >= 2, "sondeó más de una vez");
  } finally {
    server.close();
  }
});

test("runConversation reutiliza sessionId y recrea la sesión si ya no existe", async () => {
  // s1 devuelve 404 en prompt: simula una sesión muerta tras reiniciar opencode.
  const { server, requests } = await createMockServer({ deadSession: "s1" });
  try {
    const base = baseUrlOf(server);
    // Sin sessionId no se reintenta: el 404 propaga.
    await assert.rejects(
      runConversation({ baseUrl: base, modelId: "model-a", modelProviderId: "openai", systemPrompt: "", input: "uno" }),
      /404/
    );
    assert.ok(requests.includes("POST /api/session/s1/prompt"), "prompt enviado a s1");

    requests.length = 0;
    const result = await runConversation({
      baseUrl: base,
      modelId: "model-a",
      modelProviderId: "openai",
      systemPrompt: "",
      input: "dos",
      sessionId: "s1",
    });
    assert.equal(result.text, "respuesta de prueba");
    assert.ok(requests.includes("POST /api/session"), "recrea la sesión al fallar la anterior");
    assert.ok(requests.includes("POST /api/session/s2/prompt"), "reenvía el prompt a la sesión nueva");
  } finally {
    server.close();
  }
});
