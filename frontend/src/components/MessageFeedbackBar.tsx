/**
 * V1.55.6 消息反馈按钮 — 点赞/点踩 + 提交评论
 *
 * 位置：AgentPane 中 AI 消息下方
 * 行为：
 *   - 未反馈：显示两个小图标按钮
 *   - 已点赞：up 高亮，可取消
 *   - 已点踩：down 高亮，可取消
 *   - 点击评论：弹出 Popover 输入评论
 *   - 显示累计点赞/点踩数（公开）
 */
import { useEffect, useState } from 'react';
import { Button, Popover, Input, Space, message as antdMessage, theme, Tooltip } from 'antd';
import { LikeOutlined, LikeFilled, DislikeOutlined, DislikeFilled, CommentOutlined } from '@ant-design/icons';
import { agentFeedbackApi, type AgentMessageFeedback } from '../api';

const { useToken } = theme;

interface Props {
  sessionId: string | null;
  messageId: string;
  /** 当前用户对本条消息的反馈（如果有，从外部传入可避免重复请求） */
  myFeedback?: AgentMessageFeedback | null;
}

export function MessageFeedbackBar({ sessionId, messageId }: Props) {
  const { token } = useToken();
  const [up, setUp] = useState(0);
  const [down, setDown] = useState(0);
  const [myRating, setMyRating] = useState<'up' | 'down' | null>(null);
  const [myFeedbackId, setMyFeedbackId] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 加载本条消息的反馈统计 + 我的反馈
  useEffect(() => {
    if (!sessionId || sessionId.startsWith('temp_')) return;
    let cancelled = false;
    agentFeedbackApi.byMessage(sessionId, messageId)
      .then(data => {
        if (cancelled) return;
        setUp(data.up);
        setDown(data.down);
        // 找出我的反馈（按当前用户匹配）
        try {
          const authRaw = localStorage.getItem('avm-auth');
          const auth = authRaw ? JSON.parse(authRaw) : null;
          const myId = auth?.user?.id || '';
          const myUsername = auth?.user?.username || '';
          const mine = data.feedbacks.find(f =>
            f.userId === myId || f.userId === myUsername
          );
          if (mine) {
            setMyRating(mine.rating);
            setMyFeedbackId(mine.id);
            setComment(mine.comment || '');
          } else {
            setMyRating(null);
            setMyFeedbackId(null);
            setComment('');
          }
        } catch {
          // ignore
        }
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [sessionId, messageId]);

  const handleRate = async (rating: 'up' | 'down') => {
    if (!sessionId || sessionId.startsWith('temp_')) {
      antdMessage.warning('会话尚未保存，无法反馈');
      return;
    }
    if (myRating === rating && myFeedbackId) {
      // 取消反馈
      try {
        await agentFeedbackApi.remove(myFeedbackId);
        setMyRating(null);
        setMyFeedbackId(null);
        setComment('');
        setUp(u => Math.max(0, u - 1));
        antdMessage.success('已取消反馈');
      } catch (e: any) {
        antdMessage.error('取消失败: ' + (e?.message || ''));
      }
      return;
    }
    setSubmitting(true);
    try {
      const fb = await agentFeedbackApi.submit({ sessionId, messageId, rating, comment: comment || undefined });
      if (myRating === 'up') setUp(u => Math.max(0, u - 1));
      if (myRating === 'down') setDown(d => Math.max(0, d - 1));
      if (rating === 'up') setUp(u => u + 1);
      if (rating === 'down') setDown(d => d + 1);
      setMyRating(rating);
      setMyFeedbackId(fb.id);
      antdMessage.success(rating === 'up' ? '感谢您的反馈 👍' : '已记录，会持续改进 👎');
    } catch (e: any) {
      antdMessage.error('提交失败: ' + (e?.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const setMyComment = (val: string) => {
    setComment(val);
    // 同步到后端
    if (sessionId && !sessionId.startsWith('temp_') && myFeedbackId) {
      agentFeedbackApi.submit({ sessionId, messageId, rating: myRating || 'up', comment: val })
        .catch(() => { /* ignore */ });
    }
  };

  const commentContent = (
    <div style={{ width: 240 }}>
      <Input.TextArea
        value={comment}
        onChange={e => setMyComment(e.target.value)}
        placeholder="补充说明（可选）"
        autoSize={{ minRows: 2, maxRows: 5 }}
        maxLength={500}
        showCount
      />
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Button size="small" type="primary" onClick={() => setCommentOpen(false)}>完成</Button>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      fontSize: 11,
      color: token.colorTextTertiary,
    }}>
      <Tooltip title={myRating === 'up' ? '取消点赞' : '这条回复有帮助'}>
        <Button
          type="text"
          size="small"
          icon={myRating === 'up' ? <LikeFilled style={{ color: token.colorPrimary }} /> : <LikeOutlined />}
          onClick={() => handleRate('up')}
          loading={submitting}
          style={{ padding: '0 4px', height: 20, fontSize: 11 }}
        >
          {up > 0 ? up : '点赞'}
        </Button>
      </Tooltip>
      <Tooltip title={myRating === 'down' ? '取消点踩' : '这条回复不够好'}>
        <Button
          type="text"
          size="small"
          icon={myRating === 'down' ? <DislikeFilled style={{ color: token.colorError }} /> : <DislikeOutlined />}
          onClick={() => handleRate('down')}
          loading={submitting}
          style={{ padding: '0 4px', height: 20, fontSize: 11 }}
        >
          {down > 0 ? down : '点踩'}
        </Button>
      </Tooltip>
      {myRating && (
        <Popover
          content={commentContent}
          title="反馈说明"
          trigger="click"
          open={commentOpen}
          onOpenChange={setCommentOpen}
        >
          <Tooltip title="添加评论">
            <Button
              type="text"
              size="small"
              icon={<CommentOutlined style={{ color: comment ? token.colorPrimary : undefined }} />}
              style={{ padding: '0 4px', height: 20, fontSize: 11 }}
            />
          </Tooltip>
        </Popover>
      )}
    </div>
  );
}
