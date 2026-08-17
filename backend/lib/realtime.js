const subscribers = new Map();

function writeEvent(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function subscribeTenant(tenantId, res) {
  let tenantSubscribers = subscribers.get(tenantId);
  if (!tenantSubscribers) {
    tenantSubscribers = new Set();
    subscribers.set(tenantId, tenantSubscribers);
  }
  tenantSubscribers.add(res);

  const cleanup = () => {
    tenantSubscribers.delete(res);
    if (tenantSubscribers.size === 0) subscribers.delete(tenantId);
  };
  res.once("close", cleanup);
  return cleanup;
}

export function sendEvent(res, event, data) {
  writeEvent(res, event, data);
}

export function publishTenantEvent(tenantId, event, data) {
  for (const res of subscribers.get(tenantId) ?? []) writeEvent(res, event, data);
}

export function heartbeat() {
  for (const tenantSubscribers of subscribers.values()) {
    for (const res of tenantSubscribers) {
      if (!res.writableEnded) res.write(": heartbeat\n\n");
    }
  }
}
