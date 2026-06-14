import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { configureWorldview, ensureDirs, type WorldviewConfigOptions } from "./config";
import { WorldviewPipeline } from "./pipeline";
import { createRouter } from "./routes";
import { JobStore } from "./store";

export interface WorldviewServerOptions extends WorldviewConfigOptions {
  publicDir?: string;
}

export interface WorldviewServerHandle {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

function defaultPublicDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "public");
}

function isAllowedOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

export function createWorldviewApp(options: WorldviewServerOptions = {}): {
  app: express.Express;
  store: JobStore;
  pipeline: WorldviewPipeline;
  publicDir: string;
} {
  configureWorldview(options);
  ensureDirs();

  const store = new JobStore();
  const pipeline = new WorldviewPipeline(store);
  const app = express();
  const publicDir = options.publicDir ?? defaultPublicDir();

  app.use(cors);
  app.use(express.json({ limit: "200mb" }));
  app.use(createRouter(store, pipeline));
  app.use(express.static(publicDir));

  app.get("/", (_req, res) => {
    res.sendFile(join(publicDir, "index.html"));
  });

  return { app, store, pipeline, publicDir };
}

export function startWorldviewServer(options: WorldviewServerOptions = {}): Promise<WorldviewServerHandle> {
  const { app } = createWorldviewApp(options);
  const host = options.apiHost ?? "127.0.0.1";
  const requestedPort = options.apiPort ?? 0;

  return new Promise((resolve, reject) => {
    let httpServer: Server;
    try {
      httpServer = app.listen(requestedPort, host, () => {
        const addr = httpServer.address();
        const port = typeof addr === "object" && addr ? addr.port : requestedPort;
        resolve({
          port,
          url: `http://${host}:${port}`,
          stop: () =>
            new Promise<void>((res, rej) => {
              httpServer.close((err) => (err ? rej(err) : res()));
            }),
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}
