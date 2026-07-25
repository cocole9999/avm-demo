/**
 * 通用 CRUD 资源 Hook (V1.46.2)
 *
 * 封装列表页四件套：load / handleCreate / handleEdit / handleSubmit / handleDelete
 * + Drawer 开合 + form 实例 + 错误吞咽（e.errorFields）。
 *
 * 用于 CustomerPage / CarModelPage / ProjectPage / TenantPage 等典型 CRUD 列表页。
 *
 * @example
 *   const {
 *     list, loading, reload,
 *     editing, form, drawerOpen,
 *     openCreate, openEdit, closeDrawer, handleSubmit, handleDelete,
 *   } = useCrudResource({
 *     api: customerApi,
 *     initialFormValues: { type: 'internal', status: 'active' },
 *     entityName: '客户',
 *   });
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Form, App } from 'antd';
import { notifyApiError } from '../utils/apiError';

export interface CrudApi<T = any, Q = any> {
  list: (params?: Q) => Promise<T[]>;
  create: (v: Partial<T>) => Promise<T>;
  update: (id: string, v: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export interface UseCrudResourceOptions<T = any, Q = any> {
  api: CrudApi<T, Q>;
  /** 触发重新加载的依赖（如搜索词、过滤值），与 queryBuilder 配合 */
  queryDeps?: any[];
  /** 根据当前状态构造查询参数 */
  queryBuilder?: () => Q | undefined;
  /** 创建时表单初始值 */
  initialFormValues?: Partial<T>;
  /** 实体名（用于错误/成功提示文案，如 '客户' / '车型'） */
  entityName: string;
  /** 创建成功的自定义提示文案（默认 `已创建`） */
  createSuccessText?: string;
  /** 更新成功的自定义提示文案（默认 `已更新`） */
  updateSuccessText?: string;
  /** 表单值 → 提交 payload 的转换（如 dayjs → ISO） */
  formToPayload?: (v: any) => any;
  /** 提交成功后的回调（默认 reload） */
  onSubmitSuccess?: () => void;
}

export interface UseCrudResourceResult<T = any> {
  list: T[];
  loading: boolean;
  /** 表单提交中状态（用于防重复点击） */
  submitting: boolean;
  reload: () => Promise<void>;
  editing: T | null;
  form: ReturnType<typeof Form.useForm>[0];
  drawerOpen: boolean;
  openCreate: () => void;
  openEdit: (record: T) => void;
  closeDrawer: () => void;
  handleSubmit: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  setList: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useCrudResource<T = any, Q = any>(
  options: UseCrudResourceOptions<T, Q>,
): UseCrudResourceResult<T> {
  const {
    api,
    queryDeps = [],
    queryBuilder,
    initialFormValues,
    entityName,
    createSuccessText = '已创建',
    updateSuccessText = '已更新',
    formToPayload,
    onSubmitSuccess,
  } = options;

  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [list, setList] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = queryBuilder?.();
      const result = await api.list(params);
      setList(result);
    } catch (e) {
      notifyApiError(e, `加载${entityName}失败：`);
    } finally {
      setLoading(false);
    }
  }, [api, queryBuilder, entityName, message]);

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    if (initialFormValues) form.setFieldsValue(initialFormValues);
    setDrawerOpen(true);
  }, [form, initialFormValues]);

  const openEdit = useCallback((record: T) => {
    setEditing(record);
    form.setFieldsValue(record as any);
    setDrawerOpen(true);
  }, [form]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleSubmit = useCallback(async () => {
    // P0-6 防重复点击：提交中直接返回，避免重复创建
    if (submitting) return;
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const payload = formToPayload ? formToPayload(values) : values;
      if (editing) {
        await api.update((editing as any).id, payload);
        message.success(updateSuccessText);
      } else {
        await api.create(payload);
        message.success(createSuccessText);
      }
      setDrawerOpen(false);
      if (onSubmitSuccess) onSubmitSuccess();
      else reload();
    } catch (e) {
      notifyApiError(e, '保存失败：');
    } finally {
      setSubmitting(false);
    }
  }, [form, editing, api, message, reload, submitting, createSuccessText, updateSuccessText, formToPayload, onSubmitSuccess]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.remove(id);
      message.success('已删除');
      reload();
    } catch (e) {
      notifyApiError(e, '删除失败：');
    }
  }, [api, message, reload]);

  const queryDepsRef = useRef(queryDeps);
  queryDepsRef.current = queryDeps;

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, queryDeps);

  return {
    list,
    loading,
    submitting,
    reload,
    editing,
    form,
    drawerOpen,
    openCreate,
    openEdit,
    closeDrawer,
    handleSubmit,
    handleDelete,
    setList,
  };
}
