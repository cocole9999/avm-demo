/**
 * 重试工具 - 用于网络请求、数据库操作等可能临时失败的场景
 */

interface RetryOptions {
  maxRetries?: number;      // 最大重试次数，默认 3
  delayMs?: number;         // 重试间隔，默认 1000ms
  backoff?: boolean;        // 是否指数退避，默认 true
  retryOn?: (error: any) => boolean;  // 判断是否应该重试
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoff = true,
    retryOn = () => true,
  } = options;

  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }
      
      const waitTime = backoff ? delayMs * Math.pow(2, attempt) : delayMs;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[重试] 第 ${attempt + 1} 次失败，${waitTime}ms 后重试:`, errorMsg);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}

/**
 * 超时包装器 - 为异步操作添加超时控制
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = '操作',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} 超时 (${timeoutMs}ms)`));
    }, timeoutMs);
    
    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * 数据库操作重试 - 针对 Prisma 常见错误
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    delayMs: 500,
    retryOn: (error) => {
      // Prisma 连接错误、死锁、超时等可重试
      const code = error.code;
      return code === 'P1001' || // 连接失败
             code === 'P1002' || // 查询超时
             code === 'P1008' || // 查询被取消
             code === 'P1011' || // 连接池满
             code === 'P1012' || // 死锁
             code === 'P1013' || // 数据库不可用
             code === 'P1017';   // 连接关闭
    },
  });
}
