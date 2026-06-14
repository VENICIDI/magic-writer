import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { config } from "./config";
import { decodeBuffer } from "./encoding";
import { WorldviewPipeline } from "./pipeline";
import { runtimeSettings } from "./runtime-settings";
import { getWorldviewData, listCharacters, listItems, summarizeExtractions } from "./summary";
import { JobStore } from "./store";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const projectRoot = resolve(config.dataDir, "..");

function isInsideRoot(filePath: string): boolean {
  const resolved = resolve(filePath);
  return resolved === projectRoot || resolved.startsWith(`${projectRoot}\\`) || resolved.startsWith(`${projectRoot}/`);
}

export function createRouter(store: JobStore, pipeline: WorldviewPipeline): Router {
  const router = Router();
  const running = new Map<string, AbortController>();

  async function runJob(jobId: string, text: string, title: string): Promise<void> {
    const job = store.load(jobId);
    if (!job) return;
    try {
      await pipeline.run(job, text, title);
    } catch (err) {
      console.error(`后台任务异常: ${jobId}`, err);
    } finally {
      running.delete(jobId);
    }
  }

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "0.2.0" });
  });

  router.get("/settings", (_req, res) => {
    res.json(runtimeSettings.toJSON());
  });

  router.patch("/settings", (req, res) => {
    const { maxConcurrentChunks } = req.body as { maxConcurrentChunks?: number };
    if (maxConcurrentChunks != null) {
      runtimeSettings.setMaxConcurrentChunks(maxConcurrentChunks);
    }
    res.json(runtimeSettings.toJSON());
  });

  router.post("/jobs/upload", upload.single("file"), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ detail: "请上传 file 字段" });
      return;
    }

    const text = decodeBuffer(req.file.buffer);
    if (!text) {
      res.status(400).json({ detail: "无法解码上传文件，请使用 UTF-8 或 GBK 编码" });
      return;
    }

    const filename = req.file.originalname || "upload.txt";
    const title = (req.body.title as string) || filename.replace(/\.txt$/i, "");
    const job = pipeline.createJob(text, filename, title);

    writeFileSync(join(config.dataDir, "uploads", `${job.id}.txt`), text, "utf-8");

    void runJob(job.id, text, title);
    running.set(job.id, new AbortController());

    res.json({
      jobId: job.id,
      message: `任务已创建，共 ${text.length.toLocaleString()} 字，正在后台分析`,
    });
  });

  router.post("/jobs/local", (req, res) => {
    const { path: filePath, title } = req.body as { path?: string; title?: string };
    if (!filePath?.trim()) {
      res.status(400).json({ detail: "请提供 path 字段（服务器上的 txt 路径）" });
      return;
    }

    const absPath = resolve(filePath);
    if (!isInsideRoot(absPath)) {
      res.status(400).json({ detail: "仅允许读取项目目录内的文件" });
      return;
    }

    let text: string;
    try {
      const decoded = decodeBuffer(readFileSync(absPath));
      if (!decoded) {
        res.status(400).json({ detail: "无法解码文件，请使用 UTF-8 或 GBK 编码" });
        return;
      }
      text = decoded;
    } catch {
      res.status(400).json({ detail: `无法读取文件: ${filePath}` });
      return;
    }

    if (!text) {
      res.status(400).json({ detail: "无法解码文件，请使用 UTF-8 或 GBK 编码" });
      return;
    }

    const filename = absPath.split(/[/\\]/).pop() ?? "novel.txt";
    const novelTitle = title || filename.replace(/\.txt$/i, "");
    const job = pipeline.createJob(text, filename, novelTitle);

    void runJob(job.id, text, novelTitle);
    running.set(job.id, new AbortController());

    res.json({
      jobId: job.id,
      message: `任务已创建，共 ${text.length.toLocaleString()} 字，正在后台分析`,
    });
  });

  router.post("/jobs/text", (req: Request, res: Response) => {
    const { title = "", text = "" } = req.body as { title?: string; text?: string };
    if (!text.trim()) {
      res.status(400).json({ detail: "文本不能为空" });
      return;
    }

    const novelTitle = title || "未命名小说";
    const job = pipeline.createJob(text, `${novelTitle}.txt`, novelTitle);

    void runJob(job.id, text, novelTitle);
    running.set(job.id, new AbortController());

    res.json({
      jobId: job.id,
      message: `任务已创建，共 ${text.length.toLocaleString()} 字，正在后台分析`,
    });
  });

  router.get("/jobs", (req, res) => {
    const jobs = store.listJobs();
    const light = req.query.light !== "0" && req.query.light !== "false";

    if (!light) {
      res.json(jobs);
      return;
    }

    res.json(
      jobs.map((j) => ({
        id: j.id,
        title: j.report?.title ?? j.filename,
        totalChars: j.totalChars,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        progress: j.progress,
        stats: summarizeExtractions(j),
        error: j.error,
      })),
    );
  });

  router.get("/jobs/:jobId", (req, res) => {
    const job = store.load(req.params.jobId);
    if (!job) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }

    const light = req.query.light === "1" || req.query.light === "true";
    if (light) {
      res.json({
        id: job.id,
        title: job.report?.title ?? job.filename,
        totalChars: job.totalChars,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        progress: job.progress,
        stats: summarizeExtractions(job),
        reportSummary: job.report?.summary ?? null,
        error: job.error,
      });
      return;
    }

    res.json({ job });
  });

  router.get("/jobs/:jobId/summary", (req, res) => {
    const job = store.load(req.params.jobId);
    if (!job) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }
    res.json({
      jobId: job.id,
      title: job.report?.title ?? job.filename,
      progress: job.progress,
      stats: summarizeExtractions(job),
      reportSummary: job.report?.summary ?? null,
      error: job.error,
    });
  });

  router.get("/jobs/:jobId/worldview", (req, res) => {
    const job = store.load(req.params.jobId);
    if (!job) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }
    const worldview = getWorldviewData(job);
    if (
      !worldview.plotEvents.length &&
      !worldview.geography.length &&
      !worldview.characters.length &&
      !worldview.items.length
    ) {
      res.status(409).json({ detail: "尚无分析数据，请稍后再试" });
      return;
    }
    res.json({ jobId: job.id, ...worldview });
  });

  router.get("/jobs/:jobId/characters", (req, res) => {
    const job = store.load(req.params.jobId);
    if (!job) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }
    const characters = listCharacters(job);
    if (!characters.length) {
      res.status(409).json({ detail: "尚无角色数据，请稍后再试" });
      return;
    }
    res.json({ jobId: job.id, total: characters.length, characters });
  });

  router.get("/jobs/:jobId/items", (req, res) => {
    const job = store.load(req.params.jobId);
    if (!job) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }
    const items = listItems(job);
    if (!items.length) {
      res.status(409).json({ detail: "尚无物品数据，请稍后再试" });
      return;
    }
    res.json({ jobId: job.id, total: items.length, items });
  });

  router.get("/jobs/:jobId/extractions", (req, res) => {
    const job = store.load(req.params.jobId);
    if (!job) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }
    const done = job.extractions.filter((e) => e != null);
    if (!done.length) {
      res.status(409).json({ detail: "尚无提取结果，请稍后再试" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const slice = done.slice(offset, offset + limit);

    res.json({
      jobId: job.id,
      total: done.length,
      offset,
      limit,
      extractions: slice,
    });
  });

  router.get("/jobs/:jobId/report", (req, res) => {
    const job = store.load(req.params.jobId);
    if (!job) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }
    if (job.progress.status !== "completed" || !job.report) {
      res.status(409).json({ detail: `报告尚未就绪，当前状态: ${job.progress.status}` });
      return;
    }
    res.type("text/markdown; charset=utf-8").send(job.report.fullMarkdown);
  });

  router.delete("/jobs/:jobId", (req, res) => {
    running.delete(req.params.jobId);
    if (!store.delete(req.params.jobId)) {
      res.status(404).json({ detail: "任务不存在" });
      return;
    }
    res.json({ deleted: req.params.jobId });
  });

  return router;
}
