import React, { useState } from 'react';
import { submitReview } from './api';
import './ReviewModal.css';

const ReviewModal = ({ isOpen, onClose, reviewerId, revieweeId, postId, revieweeName, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleStarClick = (value) => {
    setRating(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setMessage('Please select a rating.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await submitReview({
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        post_id: postId,
        rating,
        comment
      });
      setMessage('Review submitted successfully!');
      setTimeout(() => {
        onReviewSubmitted && onReviewSubmitted();
        onClose();
      }, 1000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to submit review.');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const displayRating = hoverRating || rating;

  return (
    <div className="review-overlay" onClick={onClose}>
      <div className="review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="review-header">
          <h3>Review {revieweeName || 'Tutor'}</h3>
          <button className="review-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="review-form">
          <div className="review-rating-section">
            <label>How was your experience?</label>
            <div className="review-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`review-star ${star <= displayRating ? 'active' : ''}`}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="review-rating-text">
              {displayRating === 0 && 'Select a rating'}
              {displayRating === 1 && 'Poor'}
              {displayRating === 2 && 'Fair'}
              {displayRating === 3 && 'Good'}
              {displayRating === 4 && 'Very Good'}
              {displayRating === 5 && 'Excellent'}
            </span>
          </div>

          <div className="review-comment-section">
            <label>Comments (optional)</label>
            <textarea
              className="review-textarea"
              rows="4"
              placeholder="Share your experience with this tutor..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength="500"
            />
            <span className="review-char-count">{comment.length}/500</span>
          </div>

          {message && (
            <div className={`review-message ${message.includes('Failed') || message.includes('Please') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          <div className="review-actions">
            <button type="button" className="review-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="review-btn-submit" disabled={loading || rating === 0}>
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
