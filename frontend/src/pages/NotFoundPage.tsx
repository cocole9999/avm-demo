import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

/**
 * V1.48: 404 兜底页面
 * - 用户访问不存在的路由时展示
 * - 提供"返回工作台"快捷入口
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在。"
      extra={
        <Button type="primary" onClick={() => navigate('/workbench')}>
          返回工作台
        </Button>
      }
      style={{ paddingTop: 80 }}
    />
  );
}
