/**
 * Swagger UI 配置 (V1.46.1)
 *
 * - /api-docs: Swagger UI 交互式文档
 * - /api-docs.json: 原始 OpenAPI 3.0 JSON
 *
 * 自动生成的 spec 位于 swagger-output.json, 由 scripts/gen-swagger.mjs 生成
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

let swaggerDocument: any;
try {
  // __dirname 在 commonjs 模式下直接可用
  const raw = readFileSync(join(__dirname, '..', 'swagger-output.json'), 'utf-8');
  swaggerDocument = JSON.parse(raw);
} catch {
  // swagger-output.json 不存在时降级为最小 spec, 避免启动崩溃
  swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'AVM Project Center API',
      version: '1.46.0',
      description: '⚠️ swagger-output.json 未生成, 请运行 `npm run gen:swagger`',
    },
    paths: {},
  };
}

export function mountSwagger(app: Express) {
  // Swagger UI 交互式文档
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'AVM API 文档',
    customfavIcon: '/favicon.ico',
  }));

  // 原始 OpenAPI JSON (供第三方工具消费)
  app.get('/api-docs.json', (_req, res) => {
    res.json(swaggerDocument);
  });
}
