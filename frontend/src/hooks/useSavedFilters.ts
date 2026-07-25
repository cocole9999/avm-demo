/**
 * V1.52 保存筛选条件 — localStorage 持久化 + 可选云端同步（团队共享）
 *
 * 用法：
 *   const { savedFilters, saveFilter, deleteFilter, applyFilter, shareFilter } =
 *     useSavedFilters('work-items-requirement', currentFilters, { cloudSync: true });
 *
 * 模式：
 *   - cloudSync = false（默认）：仅 localStorage，纯本地
 *   - cloudSync = true：双写 — localStorage 保留离线缓存 + 云端持久化 + 团队共享
 *   - 云端失败时降级为本地（不阻塞 UI）
 */
import { useState, useCallback, useEffect } from 'react';
import { savedFilterApi, CloudSavedFilter } from '../api';

export interface SavedFilter<T = Record<string, any>> {
  id: string;
  name: string;
  filters: T;
  shared: boolean;
  ownerId?: string;
  ownerName?: string;
  createdAt: string;
  /** local 来自本地缓存；cloud 来自云端；cloud-shared 来自他人共享 */
  source: 'local' | 'cloud' | 'cloud-shared';
}

interface Options {
  /** 是否启用云端同步 + 团队共享 */
  cloudSync?: boolean;
}

const STORAGE_PREFIX = 'avm-saved-filters-';

function loadFromStorage<T>(key: string): SavedFilter<T>[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, list: SavedFilter<T>[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(list));
  } catch {
    const trimmed = list.slice(-20);
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(trimmed));
    } catch {
      // 放弃
    }
  }
}

/** 把云端响应统一为 SavedFilter 形态 */
function fromCloud<T>(f: CloudSavedFilter, currentUserId?: string): SavedFilter<T> {
  return {
    id: f.id,
    name: f.name,
    filters: f.filters as T,
    shared: f.shared,
    ownerId: f.ownerId,
    ownerName: f.ownerName,
    createdAt: f.createdAt,
    source: f.shared && f.ownerId !== currentUserId ? 'cloud-shared' : 'cloud',
  };
}

export function useSavedFilters<T extends Record<string, any>>(
  resourceKey: string,
  currentFilters: T,
  options: Options = {},
) {
  const { cloudSync = false } = options;
  const [savedFilters, setSavedFilters] = useState<SavedFilter<T>[]>([]);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // 初始加载：本地 + 云端（若启用）
  useEffect(() => {
    const local = loadFromStorage<T>(resourceKey);
    setSavedFilters(local);
    if (cloudSync) {
      savedFilterApi.list(resourceKey)
        .then(list => {
          setCloudError(null);
          // 合并：云端覆盖本地同名项；本地独有保留为 source='local' 兼容离线
          const cloudMapped = list.map(f => fromCloud<T>(f));
          const localByName = new Map(local.filter(l => l.source === 'local').map(l => [l.name, l]));
          const cloudByName = new Map(cloudMapped.map(c => [c.name, c]));
          const merged: SavedFilter<T>[] = [];
          // 云端优先
          for (const c of cloudMapped) merged.push(c);
          // 仅本地独有追加
          for (const [name, l] of localByName) {
            if (!cloudByName.has(name)) merged.push(l);
          }
          setSavedFilters(merged);
        })
        .catch(e => {
          setCloudError(e?.message || '云端筛选加载失败');
          // 失败保留本地
        });
    }
  }, [resourceKey, cloudSync]);

  /** 持久化到本地 + 可选同步到云端 */
  const persistAll = useCallback((next: SavedFilter<T>[]) => {
    setSavedFilters(next);
    // 本地只保留 source='local' 的项作为离线缓存
    const localOnly = next.filter(f => f.source === 'local');
    saveToStorage(resourceKey, localOnly);
  }, [resourceKey]);

  const saveFilter = useCallback((name: string, shared = false): SavedFilter<T> | null => {
    if (!name?.trim()) return null;
    const trimmed = name.trim();

    // 本地态
    const localItem: SavedFilter<T> = {
      id: `flt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      filters: { ...currentFilters },
      shared,
      createdAt: new Date().toISOString(),
      source: 'local',
    };
    // 云端态
    const next: SavedFilter<T>[] = (() => {
      // 同名去重：本地项标记为 cloud（即将被云端覆盖）
      const others = savedFilters.filter(f => f.name !== trimmed);
      return [...others, localItem];
    })();
    persistAll(next);

    // 云端同步
    if (cloudSync) {
      savedFilterApi.create({ resourceKey, name: trimmed, filters: { ...currentFilters }, shared })
        .then(cloud => {
          setSavedFilters(prev => {
            const mapped = fromCloud<T>(cloud);
            // 移除刚加的本地版（同名），添加云端版
            const others = prev.filter(f => f.name !== trimmed || f.source !== 'local');
            const localOnly = prev.filter(f => f.source === 'local' && f.name !== trimmed);
            const out = [...localOnly, mapped];
            saveToStorage(resourceKey, out.filter(x => x.source === 'local'));
            return out;
          });
        })
        .catch(e => setCloudError(e?.message || '云端保存失败'));
    }
    return localItem;
  }, [resourceKey, currentFilters, savedFilters, persistAll, cloudSync]);

  const deleteFilter = useCallback((id: string) => {
    const target = savedFilters.find(f => f.id === id);
    // 本地先删
    const next = savedFilters.filter(f => f.id !== id);
    persistAll(next);
    // 云端
    if (cloudSync && target && target.source !== 'local') {
      savedFilterApi.remove(id).catch(e => setCloudError(e?.message || '云端删除失败'));
    }
  }, [savedFilters, persistAll, cloudSync]);

  const applyFilter = useCallback((f: SavedFilter<T>): T => {
    return { ...f.filters };
  }, []);

  /** 切换团队共享（仅云端项） */
  const shareFilter = useCallback((id: string, shared: boolean) => {
    if (!cloudSync) return;
    const target = savedFilters.find(f => f.id === id);
    if (!target || target.source === 'local') return;
    savedFilterApi.update(id, { shared })
      .then(updated => {
        setSavedFilters(prev => prev.map(f => f.id === id ? fromCloud<T>(updated) : f));
      })
      .catch(e => setCloudError(e?.message || '云端共享切换失败'));
  }, [savedFilters, cloudSync]);

  /** 重命名（仅云端项） */
  const renameFilter = useCallback((id: string, name: string) => {
    if (!name?.trim()) return;
    const target = savedFilters.find(f => f.id === id);
    if (!target || target.source === 'local') return;
    if (cloudSync) {
      savedFilterApi.update(id, { name: name.trim() })
        .then(updated => {
          setSavedFilters(prev => prev.map(f => f.id === id ? fromCloud<T>(updated) : f));
        })
        .catch(e => setCloudError(e?.message || '云端重命名失败'));
    } else {
      setSavedFilters(prev => prev.map(f => f.id === id ? { ...f, name: name.trim() } : f));
    }
  }, [savedFilters, cloudSync]);

  return {
    savedFilters,
    saveFilter,
    deleteFilter,
    applyFilter,
    shareFilter,
    renameFilter,
    cloudError,
  };
}
