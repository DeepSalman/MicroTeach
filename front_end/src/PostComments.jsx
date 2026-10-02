import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPostComment, fetchPostComments } from './api';
import { avatarStyle } from './utils';
import './PostComments.css';

const getInitials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

const getTimeAgo = (dateValue) => {
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const buildCommentTree = (comments) => {
  const byId = new Map(comments.map((comment) => [comment.comment_id, { ...comment, replies: [] }]));
  const roots = [];
  byId.forEach((comment) => {
    const parent = comment.parent_comment_id && byId.get(comment.parent_comment_id);
    if (parent) parent.replies.push(comment);
    else roots.push(comment);
  });
  return roots;
};

const CommentItem = ({ comment, depth, user, onReply, onLoginRequired }) => (
  <article className={`post-comment${depth > 0 ? ' post-comment--reply' : ''}`}>
    <div className="post-comment-avatar" style={avatarStyle(comment.author_avatar_color)}>
      {getInitials(comment.author_name)}
    </div>
    <div className="post-comment-body">
      <div className="post-comment-meta">
        <strong>{comment.author_name}</strong>
        <span>{getTimeAgo(comment.created_at)}</span>
      </div>
      {comment.author_department && <div className="post-comment-department">{comment.author_department}</div>}
      <p className="post-comment-content">{comment.content}</p>
      <button
        type="button"
        className="post-comment-reply"
        onClick={() => (user ? onReply(comment) : onLoginRequired())}
      >
        {user ? 'Reply' : 'Log in to reply'}
      </button>
      {comment.replies.length > 0 && (
        <div className="post-comment-replies">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.comment_id}
              comment={reply}
              depth={depth + 1}
              user={user}
              onReply={onReply}
              onLoginRequired={onLoginRequired}
            />
          ))}
        </div>
      )}
    </div>
  </article>
);

const PostComments = ({ postId, user, onLoginRequired }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadComments = useCallback(() => (
    fetchPostComments(postId)
      .then((response) => setComments(Array.isArray(response.data) ? response.data : []))
      .catch(() => setError('Comments could not be loaded.'))
      .finally(() => setLoading(false))
  ), [postId]);

  useEffect(() => {
    setLoading(true);
    loadComments();
  }, [loadComments]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.user_id) {
      onLoginRequired();
      return;
    }
    const trimmedContent = content.trim();
    if (!trimmedContent || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await createPostComment({
        post_id: postId,
        user_id: user.user_id,
        parent_comment_id: replyTo?.comment_id || null,
        content: trimmedContent
      });
      setComments((current) => [...current, response.data]);
      setContent('');
      setReplyTo(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your comment could not be posted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pd-section post-comments-section">
      <div className="pd-section-header">
        <h4>Comments</h4>
        <span className="pd-count">{comments.length}</span>
      </div>

      {loading ? (
        <div className="pd-loading">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="post-comments-empty">No comments yet.</div>
      ) : (
        <div className="post-comment-list">
          {commentTree.map((comment) => (
            <CommentItem
              key={comment.comment_id}
              comment={comment}
              depth={0}
              user={user}
              onReply={setReplyTo}
              onLoginRequired={onLoginRequired}
            />
          ))}
        </div>
      )}

      {error && <p className="post-comment-error" role="alert">{error}</p>}

      {user ? (
        <form className="post-comment-form" onSubmit={handleSubmit}>
          {replyTo && (
            <div className="post-comment-replying">
              Replying to {replyTo.author_name}
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">&times;</button>
            </div>
          )}
          <label className="post-comment-sr-only" htmlFor={`post-comment-${postId}`}>
            {replyTo ? `Reply to ${replyTo.author_name}` : 'Write a comment'}
          </label>
          <textarea
            id={`post-comment-${postId}`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={replyTo ? 'Write a reply...' : 'Ask a question or share a helpful detail...'}
          />
          <div className="post-comment-form-footer">
            <span>{content.length}/2000</span>
            <button type="submit" disabled={!content.trim() || submitting}>
              {submitting ? 'Posting...' : replyTo ? 'Post reply' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="post-comments-login">
          <span>Sign in to join the discussion.</span>
          <button type="button" onClick={onLoginRequired}>Log in</button>
        </div>
      )}
    </section>
  );
};

export default PostComments;