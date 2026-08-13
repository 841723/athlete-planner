/* Web Push worker. Keep notification navigation same-origin. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() ?? "" }; }
  event.waitUntil(self.registration.showNotification(
    typeof data.title === "string" ? data.title : "edasi",
    {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/edasi-square.png",
      badge: "/edasi-square.png",
      data: { url: typeof data.url === "string" ? data.url : "/" },
    },
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url;
  let target = new URL("/", self.location.origin);
  try {
    const candidate = new URL(typeof raw === "string" ? raw : "/", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch { /* fallback to app root */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => "focus" in client);
    if (existing) {
      await existing.navigate(target.href);
      return existing.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
