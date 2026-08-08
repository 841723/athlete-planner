function matchPattern(pattern, pathname) {
  const p = pattern.split("/").filter(Boolean);
  const s = pathname.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    const pk = p[i];
    const sv = s[i];
    if (pk.startsWith(":")) {
      params[pk.slice(1)] = decodeURIComponent(sv);
    } else if (pk !== sv) {
      return null;
    }
  }
  return params;
}

export function createRouter() {
  const routes = [];
  const api = {
    get: (pattern, handler) => routes.push({ method: "GET", pattern, handler }),
    post: (pattern, handler) => routes.push({ method: "POST", pattern, handler }),
    put: (pattern, handler) => routes.push({ method: "PUT", pattern, handler }),
    delete: (pattern, handler) => routes.push({ method: "DELETE", pattern, handler }),
    handle(req, res, url, ctx) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const params = matchPattern(r.pattern, url.pathname);
        if (params === null) continue;
        return { matched: true, result: r.handler({ ...ctx, req, res, url, params }) };
      }
      return null;
    },
  };
  return api;
}
