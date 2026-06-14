import { startWorldviewServer } from "./server";
import { config } from "./config";

const server = await startWorldviewServer({
  apiHost: config.apiHost,
  apiPort: config.apiPort,
});

console.log(`世界观分析服务已启动: ${server.url}`);
console.log(`前端界面: ${server.url}/`);
console.log(`健康检查: GET /health`);
