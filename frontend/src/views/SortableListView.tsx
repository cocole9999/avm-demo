/**
 * V1.49 SortableListView - 可拖拽排序的工作项列表
 *
 * 特性：
 * - 使用 @dnd-kit/sortable 拖拽排序
 * - 拖拽顺序保存到 localStorage（key: avm-workitem-order-{type}）
 * - 跨刷新保持自定义顺序
 * - 支持键盘拖拽（Space 拾起，方向键移动，Space 放下）
 * - 拖拽时显示抓取指示
 *
 * 适用：用户希望自定义工作项优先级（不受 key 字典序限制）
 */
import { useState, useMemo, useEffect } from 'react';
import { Card, Empty, Tag, Space, Button, Tooltip, message } from 'antd';
import {
  HolderOutlined, CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { WorkItem } from '../types';
import { PRIORITY_COLOR, STATUS_COLOR, TYPE_COLOR, TYPE_LABEL } from '../types';

interface Props {
  items: WorkItem[];
  type: string;
  onItemClick?: (item: WorkItem) => void;
  onStatusChange?: (id: string, status: string) => void;
}

const LS_KEY_PREFIX = 'avm-workitem-order-';

function loadOrder(type: string): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY_PREFIX + type);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveOrder(type: string, ids: string[]) {
  try { localStorage.setItem(LS_KEY_PREFIX + type, JSON.stringify(ids)); }
  catch { /* 静默 */ }
}

function SortableRow({ item, onItemClick }: { item: WorkItem; onItemClick?: (i: WorkItem) => void }) {
  const navigate = useNavigate();
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#e6f4ff' : '#fff',
    border: '1px solid #f0f0f0',
    borderRadius: 6,
    padding: '8px 12px',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'grab',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
  } as const;

  const isOverdue = item.planEnd && dayjs().isAfter(dayjs(item.planEnd))
    && !['已完成', '已关闭', '已驳回', '已发布', '已验收'].includes(item.status);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <HolderOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />
      <Tag color={TYPE_COLOR[item.type]} style={{ margin: 0 }}>{item.key}</Tag>
      <Tag color={PRIORITY_COLOR[item.priority]} style={{ margin: 0 }}>{item.priority}</Tag>
      <Tag color={STATUS_COLOR[item.status]} style={{ margin: 0 }}>{item.status}</Tag>
      <a
        style={{ flex: 1, color: '#1677ff' }}
        onClick={(e) => {
          e.stopPropagation();
          if (onItemClick) onItemClick(item);
          else navigate(`/work-items/${item.type}/${item.id}`);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {item.title}
      </a>
      {item.assignee && <Tag color="blue">{item.assignee}</Tag>}
      {item.planEnd && (
        <Tooltip title={isOverdue ? '已延期' : '计划完成'}>
          <Tag color={isOverdue ? 'red' : 'default'}>
            {dayjs(item.planEnd).format('MM-DD')}
          </Tag>
        </Tooltip>
      )}
      {item.estimate != null && <Tag>{item.estimate} 点</Tag>}
    </div>
  );
}

export function SortableListView({ items, type, onItemClick, onStatusChange: _ocs }: Props) {
  const [order, setOrder] = useState<string[]>([]);

  // 加载持久化顺序
  useEffect(() => {
    setOrder(loadOrder(type));
  }, [type]);

  // 派生排序后的 items
  const sortedItems = useMemo(() => {
    if (order.length === 0) return items;
    const orderMap = new Map(order.map((id, idx) => [id, idx]));
    return [...items].sort((a, b) => {
      const ai = orderMap.get(a.id);
      const bi = orderMap.get(b.id);
      // 已排序的在前面（按 order 数组位置），未排序的按原顺序追加在末尾
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return 0;
    });
  }, [items, order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedItems.findIndex(i => i.id === active.id);
    const newIndex = sortedItems.findIndex(i => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newItems = arrayMove(sortedItems, oldIndex, newIndex);
    setOrder(newItems.map(i => i.id));
    saveOrder(type, newItems.map(i => i.id));
  };

  const handleReset = () => {
    setOrder([]);
    saveOrder(type, []);
    message.success('已重置为默认顺序');
  };

  if (items.length === 0) {
    return <Empty description="暂无数据" />;
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <span style={{ color: '#666', fontSize: 13 }}>
            💡 拖拽 <HolderOutlined /> 可调整顺序，自动保存
          </span>
        </Space>
        <Space>
          <Tooltip title="清空自定义顺序，恢复默认排序">
            <Button icon={<ReloadOutlined />} size="small" onClick={handleReset}>重置顺序</Button>
          </Tooltip>
        </Space>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {sortedItems.map(item => (
            <SortableRow key={item.id} item={item} onItemClick={onItemClick} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
