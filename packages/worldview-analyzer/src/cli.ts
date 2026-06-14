#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { ensureDirs } from "./config";
import { decodeBuffer } from "./encoding";
import { WorldviewPipeline } from "./pipeline";
import { JobStore } from "./store";
import { formatExtractionSummary } from "./summary";

function printHelp(): void {
  console.log(`用法:
  worldview-analyze <小说.txt> [选项]     分析小说
  worldview-analyze inspect [任务ID]      查看已提取内容摘要

分析维度: 主线 / 世界观 / 角色 / 物品

分析选项:
  -t, --title <名称>   小说标题
  -o, --output <目录>  输出目录 (默认 ./output)
  --json               同时输出结构化 JSON

查看选项:
  inspect              查看最新任务的提取摘要
  inspect <任务ID>     查看指定任务
`);
}

function parseAnalyzeArgs(args: string[]) {
  let file = "";
  let title = "";
  let output = "./output";
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-t" || a === "--title") {
      title = args[++i] ?? "";
    } else if (a === "-o" || a === "--output") {
      output = args[++i] ?? "./output";
    } else if (a === "--json") {
      json = true;
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (!a.startsWith("-")) {
      file = a;
    }
  }

  return { file, title, output, json };
}

async function runInspect(jobId?: string): Promise<number> {
  ensureDirs();
  const store = new JobStore();
  let job;

  if (jobId) {
    job = store.load(jobId);
    if (!job) {
      console.error(`任务不存在: ${jobId}`);
      return 1;
    }
  } else {
    const jobs = store.listJobs();
    if (!jobs.length) {
      console.error("尚无任务，请先运行分析");
      return 1;
    }
    job = jobs[0];
  }

  console.log(formatExtractionSummary(job));
  console.log("");
  console.log(`完整 JSON: data/jobs/${job.id}.json`);
  console.log(`查看某块详情: data/jobs/${job.id}.json → extractions 数组`);
  return 0;
}

async function runAnalyze(argv: string[]): Promise<number> {
  const { file, title, output, json } = parseAnalyzeArgs(argv);
  if (!file) {
    console.error("请指定小说文件路径");
    return 1;
  }

  ensureDirs();

  const path = resolve(file);
  const buffer = readFileSync(path);
  const text = decodeBuffer(buffer);
  if (!text) {
    console.error(`无法解码: ${path}`);
    return 1;
  }

  const novelTitle = title || basename(path, ".txt");
  console.log(`读取 ${basename(path)}，共 ${text.length.toLocaleString()} 字`);

  const pipeline = new WorldviewPipeline();
  const job = pipeline.createJob(text, basename(path), novelTitle);
  console.log(`任务 ID: ${job.id}`);
  console.log(`提取过程中可另开终端运行: npm run cli -- inspect ${job.id}`);

  const onProgress = (j: typeof job) => {
    const p = j.progress;
    process.stdout.write(`\r[${p.percent.toFixed(1).padStart(5)}%] ${p.currentStage}: ${p.message}`);
  };

  try {
    await pipeline.run(job, text, novelTitle, onProgress);
  } catch (err) {
    console.error(`\n分析失败: ${String(err)}`);
    return 2;
  }

  console.log("\n分析完成。");

  mkdirSync(output, { recursive: true });
  const reportPath = resolve(output, `${novelTitle}_分析报告.md`);
  writeFileSync(reportPath, job.report?.fullMarkdown ?? "", "utf-8");
  console.log(`报告已保存: ${reportPath}`);

  if (json) {
    const jsonPath = resolve(output, `${novelTitle}_结构化数据.json`);
    writeFileSync(jsonPath, JSON.stringify(job.report, null, 2), "utf-8");
    console.log(`JSON 已保存: ${jsonPath}`);
  }

  return 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (!args.length || args[0] === "-h" || args[0] === "--help") {
    printHelp();
    return args.length ? 0 : 1;
  }

  if (args[0] === "inspect") {
    return runInspect(args[1]);
  }

  return runAnalyze(args);
}

main().then((code) => process.exit(code));
