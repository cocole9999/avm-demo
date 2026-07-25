/**
 * Swagger 自动生成脚本 (V1.46.1)
 *
 * 用法: npm run gen:swagger
 *
 * 原理: 直接扫描 src/index.ts 的 app.use() 挂载 + 各路由文件的 router.METHOD() 调用
 *        组合生成完整的 OpenAPI 3.0 spec
 *
 * 优势 (相比 swagger-autogen 默认扫描):
 *   - 能识别 app.use('/api/xxx', router) 挂载的外部 router 文件
 *   - 路径前缀准确
 *   - 支持路径参数 (:id -> {id})
 *
 * 生成的 spec 包含:
 *   - 所有路由路径 + HTTP 方法
 *   - 路径参数 (/api/work-items/{id})
 *   - 按模块分组 (tags)
 *   - 默认响应 (200/201 + application/json)
 *
 * 不包含 (需手动补充):
 *   - 请求体 schema (POST/PATCH body)
 *   - 响应体 schema
 *   - 字段含义描述
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..');
const srcRoot = join(backendRoot, 'src');
const indexFile = join(srcRoot, 'index.ts');

// ========== 路由前缀 -> Tag 映射 ==========
const PREFIX_TAG_MAP = {
  '/api/work-items': '工作项',
  '/api/iterations': '迭代',
  '/api/comments': '评论',
  '/api/activities': '活动',
  '/api/meta': '元数据',
  '/api/flows': '流程',
  '/api/reviews': '评审',
  '/api/charts': '图表',
  '/api/dashboards': '仪表盘',
  '/api/ai': 'AI',
  '/api/ai-command': 'AI',
  '/api/agent': 'AI',
  '/api/export': '数据',
  '/api/dependencies': '工作项',
  '/api/users': '系统',
  '/api/spaces': '系统',
  '/api/notifications': '系统',
  '/api/favorites': '系统',
  '/api/resources': '资源',
  '/api/search': '系统',
  '/api/workbench': '工作项',
  '/api/fields': '数据',
  '/api/templates': '数据',
  '/api/automation': '自动化',
  '/api/webhooks': '自动化',
  '/api/imports': '数据',
  '/api/handover': '工作项',
  '/api/tree': '工作项',
  '/api/analysis': '资源',
  '/api/baselines': '资源',
  '/api/mcp': 'AI',
  '/api/tests': '系统',
  '/api/sso': '系统',
  '/api/llm-settings': 'AI',
  '/api/customers': '项目',
  '/api/car-models': '项目',
  '/api/contacts': '项目',
  '/api/projects': '项目',
  '/api/audit-logs': '系统',
  '/api/mentions': '系统',
  '/api/uploads': '数据',
  '/api/upload': '数据',
  '/api/health': '系统',
};

// ========== 1. 解析 index.ts，提取 prefix -> routerFile 映射 ==========
function parseIndexTs() {
  const content = fs.readFileSync(indexFile, 'utf-8');
  const importMap = {}; // routerVarName -> filePath

  // 匹配: import { xxxRouter, yyyRouter } from './routes/xxx';
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const names = m[1].split(',').map(s => s.trim());
    const fromPath = m[2];
    if (fromPath.includes('/routes/')) {
      const filePath = join(srcRoot, fromPath + '.ts');
      if (fs.existsSync(filePath)) {
        for (const name of names) {
          importMap[name] = filePath;
        }
      }
    }
  }

  // 匹配: app.use('/api/xxx', xxxRouter);
  const routes = [];
  const useRegex = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;
  while ((m = useRegex.exec(content)) !== null) {
    const prefix = m[1];
    const routerName = m[2];
    const file = importMap[routerName];
    if (file && fs.existsSync(file)) {
      routes.push({ prefix, file, routerName });
    }
  }
  return routes;
}

// ========== 2. 扫描路由文件，提取 router.METHOD('/path', ...) ==========
function scanRouterFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const endpoints = [];
  // 匹配: router.get('/path', ...), router.post('/path', ...), 也匹配 xxxRouter.get(...)
  const methodRegex = /\w*Router\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    endpoints.push({ method: m[1].toLowerCase(), path: m[2] });
  }
  return endpoints;
}

// ========== 3. 组合 prefix + path，生成 OpenAPI paths ==========
function combinePath(prefix, routePath) {
  let fullPath = prefix;
  if (routePath !== '/' && routePath !== '') {
    fullPath = routePath.startsWith('/')
      ? prefix + routePath
      : prefix + '/' + routePath;
  }
  // 去除尾部斜杠 (保留根路径)
  if (fullPath.length > 1 && fullPath.endsWith('/')) {
    fullPath = fullPath.slice(0, -1);
  }
  // Express :param -> OpenAPI {param}
  return fullPath.replace(/:([^/]+)/g, '{$1}');
}

function buildPaths(routes) {
  const paths = {};
  let totalEndpoints = 0;

  for (const { prefix, file } of routes) {
    const tag = PREFIX_TAG_MAP[prefix] || '其他';
    const endpoints = scanRouterFile(file);
    for (const { method, path: routePath } of endpoints) {
      const openApiPath = combinePath(prefix, routePath);
      if (!paths[openApiPath]) paths[openApiPath] = {};
      // 跳过重复定义 (同一 path + method 多次出现)
      if (paths[openApiPath][method]) continue;
      paths[openApiPath][method] = {
        tags: [tag],
        summary: '',
        responses: {
          200: { description: 'OK' },
        },
      };
      totalEndpoints++;
    }
  }
  return { paths, totalEndpoints };
}

// ========== 4. 生成 OpenAPI spec ==========
function buildSpec() {
  const routes = parseIndexTs();
  console.log(`📦 扫描到 ${routes.length} 个路由模块`);

  const { paths, totalEndpoints } = buildPaths(routes);
  console.log(`📋 提取到 ${totalEndpoints} 个 API 端点`);

  // 统计每个 tag 的端点数
  const tagCounts = {};
  for (const path of Object.keys(paths)) {
    for (const method of Object.keys(paths[path])) {
      const tag = paths[path][method].tags[0];
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  console.log('   分布:', tagCounts);

  // 构建去重后的 tags 数组
  const tagSet = new Set();
  for (const path of Object.keys(paths)) {
    for (const method of Object.keys(paths[path])) {
      paths[path][method].tags.forEach(t => tagSet.add(t));
    }
  }
  const tagDescMap = {
    '工作项': '需求/任务/缺陷/版本管理',
    '迭代': 'Sprint 迭代管理',
    '评审': '评审中心',
    '流程': '流程引擎 + 节点',
    '自动化': '无代码自动化规则',
    '仪表盘': '度量仪表盘 + 图表',
    'AI': 'AI 智能助理 + 命令',
    '资源': '人员排期 + 分析',
    '项目': '项目/客户/车型',
    '系统': '用户/空间/通知/审计',
    '数据': '导入/导出/模板',
    '评论': '工作项评论',
    '活动': '活动记录',
    '元数据': '字段/选项元数据',
    '图表': '图表数据',
    '其他': '未分类',
  };
  const tags = Array.from(tagSet).map(name => ({
    name,
    description: tagDescMap[name] || '',
  }));

  return {
    openapi: '3.0.0',
    info: {
      title: 'AVM Project Center API',
      version: '1.46.0',
      description: `AVM 项目中心后端 API 文档

## 概述
AVM 是面向汽车软件开发的项目管理中心，覆盖需求/任务/缺陷/版本全生命周期管理。

## 认证
- 开发模式: 无需认证 (自动识别为 dev-user / tenant_admin)
- 生产模式: Bearer Token (JWT)
- Token 通过 POST /api/sso/login 获取

## 主要模块
- 工作项管理 (需求/任务/缺陷/版本)
- 迭代管理
- 评审中心
- 流程引擎
- 自动化
- 度量仪表盘
- AI 智能助理
- 资源排期
- 项目/客户/车型管理

## 备注
- 路径参数使用 OpenAPI 风格 \`{id}\`
- 请求体/响应体 schema 待手动补充`,
      contact: { name: 'AVM Team' },
    },
    servers: [
      { url: 'http://localhost:4000/' },
      { url: 'https://localhost:4000/' },
    ],
    tags,
    paths,
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Resource not found' },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Bearer JWT Token',
        },
      },
    },
  };
}

// ========== 主流程 ==========
const spec = buildSpec();
const outputFile = join(backendRoot, 'swagger-output.json');
fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2), 'utf-8');

console.log(`✅ Swagger spec 已生成: ${outputFile}`);
console.log(`   启动后端后访问: http://localhost:4000/api-docs`);
console.log(`   路径总数: ${Object.keys(spec.paths).length}`);
