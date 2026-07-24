/**
 * 评审引擎单元测试
 * 测试 createReview / getReview / submitReviewItems / finalizeReview / 模板管理
 * 通过 vi.hoisted + vi.mock 模拟 prisma
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    review: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    reviewItem: {
      create: vi.fn(),
      update: vi.fn(),
    },
    reviewParticipant: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    reviewTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({ prisma: mocks.prisma }));

import {
  createReview,
  getReview,
  listReviews,
  submitReviewItems,
  finalizeReview,
  listReviewTemplates,
  createReviewTemplate,
} from './reviewEngine';

describe('services/reviewEngine - createReview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('创建评审写入 review / items / participants', async () => {
    const created = { id: 'rev-1', workItemId: 'w1', reviewType: 'code_review', title: 't', status: 'pending' };
    mocks.prisma.review.create.mockResolvedValueOnce(created);
    mocks.prisma.reviewItem.create.mockResolvedValue({});
    mocks.prisma.reviewParticipant.create.mockResolvedValue({});
    // getReview 内部调用
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ ...created, workItem: {}, items: [], participants: [] });

    const r = await createReview({
      workItemId: 'w1',
      reviewType: 'code_review',
      title: 't',
      initiator: '张三',
      items: [{ name: '代码规范', itemType: 'check' }],
      participants: [{ userId: 'u1', userName: '张三', role: 'reviewer' }],
    });

    expect(r?.id).toBe('rev-1');
    expect(mocks.prisma.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workItemId: 'w1', reviewType: 'code_review', status: 'pending',
      }),
    }));
    expect(mocks.prisma.reviewItem.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.reviewParticipant.create).toHaveBeenCalledTimes(1);
  });

  it('items 默认 maxScore=5', async () => {
    mocks.prisma.review.create.mockResolvedValueOnce({ id: 'rev-2' });
    mocks.prisma.reviewItem.create.mockResolvedValue({});
    mocks.prisma.reviewParticipant.create.mockResolvedValue({});
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'rev-2', workItem: {}, items: [], participants: [] });

    await createReview({
      workItemId: 'w1', reviewType: 'qr', title: 't', initiator: 'i',
      items: [{ name: 'a', itemType: 'score' }],
      participants: [],
    });

    expect(mocks.prisma.reviewItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ maxScore: 5 }),
    }));
  });

  it('participant 默认 weight=1', async () => {
    mocks.prisma.review.create.mockResolvedValueOnce({ id: 'rev-3' });
    mocks.prisma.reviewItem.create.mockResolvedValue({});
    mocks.prisma.reviewParticipant.create.mockResolvedValue({});
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'rev-3', workItem: {}, items: [], participants: [] });

    await createReview({
      workItemId: 'w1', reviewType: 'qr', title: 't', initiator: 'i',
      items: [], participants: [{ userId: 'u', userName: 'n', role: 'r' }],
    });

    expect(mocks.prisma.reviewParticipant.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ weight: 1 }),
    }));
  });
});

describe('services/reviewEngine - getReview / listReviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getReview 返回带 workItem/items/participants 的详情', async () => {
    const review = {
      id: 'rev-1',
      workItem: { id: 'w1', key: 'TASK-1', title: 't', type: 'task', status: '进行中' },
      items: [], participants: [],
    };
    mocks.prisma.review.findUnique.mockResolvedValueOnce(review);
    const r = await getReview('rev-1');
    expect(r).toEqual(review);
    expect(mocks.prisma.review.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'rev-1' },
      include: expect.objectContaining({ workItem: expect.anything(), items: expect.anything(), participants: expect.anything() }),
    }));
  });

  it('listReviews 不传 workItemId 时查全部', async () => {
    mocks.prisma.review.findMany.mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }]);
    const r = await listReviews();
    expect(r.length).toBe(2);
    expect(mocks.prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
    }));
  });

  it('listReviews 按 workItemId 过滤', async () => {
    mocks.prisma.review.findMany.mockResolvedValueOnce([{ id: 'r1' }]);
    await listReviews('w1');
    expect(mocks.prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workItemId: 'w1' },
    }));
  });
});

describe('services/reviewEngine - submitReviewItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('提交后标记 participant.hasResponded', async () => {
    mocks.prisma.reviewItem.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.findMany.mockResolvedValueOnce([
      { userId: 'u1', hasResponded: true },
    ]);
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1', status: 'pending' });
    mocks.prisma.review.update.mockResolvedValue({});
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1', workItem: {}, items: [], participants: [] });

    const r = await submitReviewItems('r1', 'u1', [
      { itemId: 'it-1', score: 4, comment: 'good' },
    ]);
    expect(r?.id).toBe('r1');
    expect(mocks.prisma.reviewItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'it-1' },
      data: expect.objectContaining({ score: 4, completed: true }),
    }));
  });

  it('全部提交后 review 状态变为 in_progress', async () => {
    mocks.prisma.reviewItem.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.findMany.mockResolvedValueOnce([
      { userId: 'u1', hasResponded: true },
      { userId: 'u2', hasResponded: true },
    ]);
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1', status: 'pending' });
    mocks.prisma.review.update.mockResolvedValue({});
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1' });

    await submitReviewItems('r1', 'u1', [{ itemId: 'it-1', checked: true }]);
    expect(mocks.prisma.review.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'r1' },
      data: { status: 'in_progress' },
    }));
  });

  it('部分未提交时不修改 status', async () => {
    mocks.prisma.reviewItem.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.findMany.mockResolvedValueOnce([
      { userId: 'u1', hasResponded: true },
      { userId: 'u2', hasResponded: false },
    ]);
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1', status: 'pending' });
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1' });

    await submitReviewItems('r1', 'u1', [{ itemId: 'it-1' }]);
    expect(mocks.prisma.review.update).not.toHaveBeenCalled();
  });

  it('文本类要素支持 answer 字段', async () => {
    mocks.prisma.reviewItem.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.update.mockResolvedValue({});
    mocks.prisma.reviewParticipant.findMany.mockResolvedValueOnce([{ userId: 'u1', hasResponded: true }]);
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1', status: 'pending' });
    mocks.prisma.review.findUnique.mockResolvedValueOnce({ id: 'r1' });

    await submitReviewItems('r1', 'u1', [
      { itemId: 'it-1', answer: '我的回答' },
    ]);
    expect(mocks.prisma.reviewItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ answer: '我的回答' }),
    }));
  });
});

describe('services/reviewEngine - finalizeReview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('go 结论 + 全部 check 通过 -> approved', async () => {
    mocks.prisma.review.findUnique.mockResolvedValueOnce({
      id: 'r1', workItemId: 'w1',
      items: [{ itemType: 'check', checked: true }],
      participants: [],
    });
    mocks.prisma.review.update.mockResolvedValueOnce({ id: 'r1', status: 'approved', conclusion: 'go' });
    mocks.prisma.activity.create.mockResolvedValue({});

    const r = await finalizeReview('r1', { conclusion: 'go', summary: '通过', finalizer: '张三' });
    expect(r.conclusion).toBe('go');
    expect(mocks.prisma.review.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'approved', conclusion: 'go', summary: '通过' }),
    }));
    expect(mocks.prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: 'w1', actor: '张三', action: 'review_finalized', newValue: 'go' }),
    }));
  });

  it('not_go 结论 -> rejected', async () => {
    mocks.prisma.review.findUnique.mockResolvedValueOnce({
      id: 'r1', workItemId: 'w1', items: [], participants: [],
    });
    mocks.prisma.review.update.mockResolvedValueOnce({ id: 'r1', status: 'rejected', conclusion: 'not_go' });
    mocks.prisma.activity.create.mockResolvedValue({});

    const r = await finalizeReview('r1', { conclusion: 'not_go', summary: '拒绝', finalizer: '李四' });
    expect(r.conclusion).toBe('not_go');
    expect(mocks.prisma.review.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'rejected' }),
    }));
  });

  it('check 未勾选自动升级为 go_with_risk', async () => {
    mocks.prisma.review.findUnique.mockResolvedValueOnce({
      id: 'r1', workItemId: 'w1',
      items: [{ itemType: 'check', checked: false }],
      participants: [],
    });
    mocks.prisma.review.update.mockResolvedValueOnce({ conclusion: 'go_with_risk' });
    mocks.prisma.activity.create.mockResolvedValue({});

    const r = await finalizeReview('r1', { conclusion: 'go', summary: '', finalizer: '' });
    expect(r.conclusion).toBe('go_with_risk');
  });

  it('text 类未填写升级为 go_with_risk', async () => {
    mocks.prisma.review.findUnique.mockResolvedValueOnce({
      id: 'r1', workItemId: 'w1',
      items: [{ itemType: 'text', answer: '' }],
      participants: [],
    });
    mocks.prisma.review.update.mockResolvedValueOnce({ conclusion: 'go_with_risk' });
    mocks.prisma.activity.create.mockResolvedValue({});

    const r = await finalizeReview('r1', { conclusion: 'go', summary: '', finalizer: '' });
    expect(r.conclusion).toBe('go_with_risk');
  });

  it('评审不存在抛错', async () => {
    mocks.prisma.review.findUnique.mockResolvedValueOnce(null);
    await expect(finalizeReview('no-such', { conclusion: 'go', summary: '', finalizer: '' })).rejects.toThrow(/评审不存在/);
  });
});

describe('services/reviewEngine - 模板', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listReviewTemplates 返回列表', async () => {
    mocks.prisma.reviewTemplate.findMany.mockResolvedValueOnce([{ id: 't1', name: '模板1' }]);
    const r = await listReviewTemplates();
    expect(r.length).toBe(1);
    expect(mocks.prisma.reviewTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { name: 'asc' },
    }));
  });

  it('createReviewTemplate 把 items 序列化为 JSON', async () => {
    mocks.prisma.reviewTemplate.create.mockResolvedValueOnce({ id: 't1', name: '模板1' });
    const r = await createReviewTemplate({
      name: '模板1', reviewType: 'code_review',
      items: [{ name: 'a', itemType: 'check' }],
    });
    expect(r.id).toBe('t1');
    expect(mocks.prisma.reviewTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: '模板1', reviewType: 'code_review',
        items: JSON.stringify([{ name: 'a', itemType: 'check' }]),
      }),
    }));
  });

  it('createReviewTemplate description 默认空字符串', async () => {
    mocks.prisma.reviewTemplate.create.mockResolvedValueOnce({ id: 't2' });
    await createReviewTemplate({ name: 't', reviewType: 'qr', items: [] });
    expect(mocks.prisma.reviewTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ description: '' }),
    }));
  });
});
