import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";
import type { AnalysisJob } from "./types";

export class JobStore {
  private jobsDir: string;

  constructor(dataDir = config.dataDir) {
    this.jobsDir = join(dataDir, "jobs");
  }

  private path(jobId: string): string {
    return join(this.jobsDir, `${jobId}.json`);
  }

  save(job: AnalysisJob): void {
    job.updatedAt = new Date().toISOString();
    writeFileSync(this.path(job.id), JSON.stringify(job, null, 2), "utf-8");
  }

  load(jobId: string): AnalysisJob | null {
    const file = this.path(jobId);
    try {
      const raw = readFileSync(file, "utf-8");
      return JSON.parse(raw) as AnalysisJob;
    } catch {
      return null;
    }
  }

  listJobs(): AnalysisJob[] {
    let files: string[];
    try {
      files = readdirSync(this.jobsDir).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }

    const jobs: AnalysisJob[] = [];
    for (const file of files.sort().reverse()) {
      try {
        const raw = readFileSync(join(this.jobsDir, file), "utf-8");
        jobs.push(JSON.parse(raw) as AnalysisJob);
      } catch {
        // skip corrupt files
      }
    }
    return jobs;
  }

  delete(jobId: string): boolean {
    try {
      unlinkSync(this.path(jobId));
      return true;
    } catch {
      return false;
    }
  }
}
