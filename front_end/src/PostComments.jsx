import { useEffect, useState } from 'react';
import { addPostComment, fetchPostComments } from './api';
import './PostComments.css';

const PostComments = ({ postId, user }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchPostComments(postId)
      .then((response) => {
        if (!cancelled) setComments(response.data || []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.response?.data?.message || 'Comments could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [postId]);

  const submitComment = async (event, parentCommentId = null) => {
    event.preventDefault();
    const text = (parentCommentId ? replyText : commentText).trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await addPostComment(postId, {
        user_id: user.user_id,
        comment_text: text,
        parent_comment_id: parentCommentId
      });
      setComments((current) => [...current, response.data]);
      if (parentCommentId) {
        setReplyText('');
        setReplyTo(null);
      } else {
        setCommentText('');
      }
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Your comment could not be posted.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = (comment) => {
    const replies = comments.filter((entry) => Number(entry.parent_comment_id) === Number(comment.comment_id));
    const authorName = comment.author_name || 'Campus member';

    return (
      <article className="post-comment-thread" key={comment.comment_id}>
        <div className="post-comment">
          <div className="post-comment-avatar" aria-hidden="true">{authorName.charAt(0).toUpperCase()}</div>
          <div className="post-comment-content">
            <div className="post-comment-heading">
              <strong>{authorName}</strong>
              <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time>
            </div>
            <p>{comment.comment_text}</p>
            <button
              className="post-comment-reply-button"
              type="button"
              onClick={() => { setReplyTo(comment.comment_id); setReplyText(''); setError(''); }}
            >
              Reply
            </button>
            {replyTo === comment.comment_id && (
              <form className="post-comment-reply-form" onSubmit={(event) => submitComment(event, comment.comment_id)}>
                <input
                  autoFocus
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={`Reply to ${authorName}...`}
                  maxLength={500}
                  aria-label={`Reply to ${authorName}`}
                />
                <button type="submit" disabled={submitting || !replyText.trim()}>{submitting ? 'Sending...' : 'Send'}</button>
                <button type="button" className="post-comment-cancel" onClick={() => setReplyTo(null)}>Cancel</button>
              </form>
            )}
          </div>
        </div>
        {replies.length > 0 && <div className="post-comment-replies">{replies.map(renderComment)}</div>}
      </article>
    );
  };

  const topLevelComments = comments.filter((comment) => !comment.parent_comment_id);

  return (
    <section className="post-comments" aria-labelledby={`post-comments-title-${postId}`}>
      <div className="post-comments-heading">
        <h3 id={`post-comments-title-${postId}`}>Comments</h3>
        <span>{comments.length}</span>
      </div>

      {error && <p className="post-comments-error" role="alert">{error}</p>}
      {loading ? (
        <p className="post-comments-state">Loading comments...</p>
      ) : topLevelComments.length === 0 ? (
        <p className="post-comments-state">No comments yet. Start the conversation.</p>
      ) : (
        <div className="post-comments-list">{topLevelComments.map(renderComment)}</div>
      )}

      <form className="post-comment-form" onSubmit={(event) => submitComment(event)}>
        <input
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          placeholder="Ask a question or share a helpful detail..."
          maxLength={500}
          aria-label="Write a comment"
          disabled={submitting}
        />
        <span className="post-comment-character-count">{commentText.length}/500</span>
        <button type="submit" disabled={loading || submitting || !commentText.trim()}>
          {submitting ? 'Sending...' : 'Comment'}
        </button>
      </form>
    </section>
  );
};

export default PostComments;
