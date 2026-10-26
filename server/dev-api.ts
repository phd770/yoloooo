import type { Plugin } from "vite";
import auth from "../api/auth";
import health from "../api/health";
import vaultAccess from "../api/vault-access";
import push from "../api/push";

/** Serve the same handlers locally and on Vercel. Never proxy PINs to production. */
export function devApi(): Plugin {
  return {
    name: "app-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0];
        const handler =
          pathname === "/api/auth"
            ? auth
            : pathname === "/api/health"
              ? health
              : pathname === "/api/vault-access"
              ? vaultAccess
              : pathname === "/api/push"
                ? push
                : null;
        if (!handler) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        const response = {
          status(code: number) {
            res.statusCode = code;
            return response;
          },
          json(value: unknown) {
            res.end(JSON.stringify(value));
          },
          setHeader(name: string, value: string) {
            res.setHeader(name, value);
          },
        };
        try {
          let body = "";
          for await (const chunk of req) {
            body += chunk.toString();
            if (Buffer.byteLength(body) > 4096) {
              response.status(413).json({ error: "Request too large" });
              return;
            }
          }
          await handler(Object.assign(req, { body }), response);
        } catch {
          response.status(503).json({ error: "השירות לא זמין כרגע. נסו שוב." });
        }
      });
    },
  };
}
