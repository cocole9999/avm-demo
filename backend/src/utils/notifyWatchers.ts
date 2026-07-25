/**
 * V1.52 关注通知：工作项状态变更 / 新增评论时通知所有关注者（排除触发人）
 *
 * 设计：
 * - notifyStatusChange(workItem, before, after, actor)  — 状态从 before → after 时调用
 * - notifyNewComment(comment, workItem, actor)          — 新增评论时调用
 * - 利用现有 prisma.notification + pushToUser(WS) + triggerWebhooks
 * - 通知类型: 'watch_status_change' / 'watch_comment_added'
 * - 失败不影响主流程（包 try-catch，console.error 记录）
 */
import { prisma } from '../db';
import { pushToUser } from '../services/wsServer';
import { triggerWebhooks } from '../services/webhookEngine';

/** 状态变更通知 */
export async function notifyStatusChange(
  workItem: { id: string; key: string; title: string },
  before: { status: string },
  after: { status: string },
  actor: string, // 触发变更的用户名（displayName）
) {
  if (before.status === after.status) return;
  try {
    const watchers = await prisma.workItemWatcher.findMany({
      where: { workItemId: workItem.id },
    });
    if (watchers.length === 0) return;

    // 通过 username 解析 user.id（用于 WS 推送）；username 与 userName 通常一致
    const userIds = watchers.map(w => w.userId);
    const users = await prisma.user.findMany({
      where: { OR: [{ id: { in: userIds } }, { username: { in: userIds } }] },
      select: { id: true, username: true, displayName: true },
    });
    const userByName = new Map<string, typeof users[number]>();
    for (const u of users) {
      userByName.set(u.username, u);
      userByName.set(u.displayName, u);
    }

    const title = `${actor} 将 ${workItem.key} 状态从「${before.status}」改为「${after.status}」`;
    const link = `/work-items/${workItem.key}`;
    const notifIds: string[] = [];

    for (const w of watchers) {
      // 排除触发人自己
      if (w.userName === actor) continue;
      const user = userByName.get(w.userName);
      // 1. 写通知
      const n = await prisma.notification.create({
        data: {
          recipientId: w.userName,
          actorId: actor,
          type: 'watch_status_change',
          level: after.status === '已完成' || after.status === '已关闭' ? 'success' : 'info',
          title,
          content: workItem.title,
          link,
          resourceType: 'workItem',
          resourceId: workItem.id,
          meta: JSON.stringify({
            workItemId: workItem.id,
            workItemKey: workItem.key,
            workItemTitle: workItem.title,
            beforeStatus: before.status,
            afterStatus: after.status,
            actor,
          }),
        },
      });
      notifIds.push(n.id);
      // 2. WS 推送
      if (user) {
        pushToUser(user.id, {
          type: 'notification',
          notification: {
            kind: 'watch_status_change',
            title,
            content: workItem.title,
            link,
            workItemId: workItem.id,
            workItemKey: workItem.key,
            workItemTitle: workItem.title,
            beforeStatus: before.status,
            afterStatus: after.status,
            actor,
            notifIds,
          },
        });
      }
    }

    // 3. webhook 推送
    triggerWebhooks('workItem.statusChanged', {
      event: 'workItem.statusChanged',
      workItem: { id: workItem.id, key: workItem.key, title: workItem.title },
      beforeStatus: before.status,
      afterStatus: after.status,
      actor,
      watchers: watchers.map(w => ({ username: w.userName })),
      notifIds,
    }).catch(e => console.error('[notifyStatusChange] webhook push error:', e.message));
  } catch (e: any) {
    console.error('[notifyStatusChange] failed:', e.message);
  }
}

/** 新评论通知 */
export async function notifyNewComment(
  comment: { id: string; workItemId: string; author: string; content: string; imageUrl?: string | null },
  workItem: { id: string; key: string; title: string },
  actor: string,
) {
  try {
    const watchers = await prisma.workItemWatcher.findMany({
      where: { workItemId: workItem.id },
    });
    if (watchers.length === 0) return;

    const userIds = watchers.map(w => w.userId);
    const users = await prisma.user.findMany({
      where: { OR: [{ id: { in: userIds } }, { username: { in: userIds } }] },
      select: { id: true, username: true, displayName: true },
    });
    const userByName = new Map<string, typeof users[number]>();
    for (const u of users) {
      userByName.set(u.username, u);
      userByName.set(u.displayName, u);
    }

    const contentPreview = (comment.content || '').slice(0, 200);
    const title = `${actor} 在 ${workItem.key} 发表了新评论`;
    const link = `/work-items/${workItem.key}`;
    const notifIds: string[] = [];

    for (const w of watchers) {
      // 排除评论作者自己
      if (w.userName === actor || w.userName === comment.author) continue;
      const user = userByName.get(w.userName);
      const n = await prisma.notification.create({
        data: {
          recipientId: w.userName,
          actorId: actor,
          type: 'watch_comment_added',
          level: 'info',
          title,
          content: contentPreview,
          link,
          resourceType: 'workItem',
          resourceId: workItem.id,
          meta: JSON.stringify({
            workItemId: workItem.id,
            workItemKey: workItem.key,
            workItemTitle: workItem.title,
            commentId: comment.id,
            actor,
            contentPreview,
            hasImage: !!comment.imageUrl,
          }),
        },
      });
      notifIds.push(n.id);
      if (user) {
        pushToUser(user.id, {
          type: 'notification',
          notification: {
            kind: 'watch_comment_added',
            title,
            content: contentPreview,
            link,
            workItemId: workItem.id,
            workItemKey: workItem.key,
            workItemTitle: workItem.title,
            commentId: comment.id,
            actor,
            hasImage: !!comment.imageUrl,
            notifIds,
          },
        });
      }
    }

    triggerWebhooks('workItem.commentAdded', {
      event: 'workItem.commentAdded',
      workItem: { id: workItem.id, key: workItem.key, title: workItem.title },
      comment: {
        id: comment.id,
        author: comment.author,
        content: comment.content,
        hasImage: !!comment.imageUrl,
      },
      actor,
      watchers: watchers.map(w => ({ username: w.userName })),
      notifIds,
    }).catch(e => console.error('[notifyNewComment] webhook push error:', e.message));
  } catch (e: any) {
    console.error('[notifyNewComment] failed:', e.message);
  }
}
