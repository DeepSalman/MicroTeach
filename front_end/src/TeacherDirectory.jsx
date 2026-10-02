import { useEffect, useMemo, useState } from 'react';
import { fetchTeachers, fetchUserProfile, fetchUserReviews } from './api';
import { avatarStyle } from './utils';
import './TeacherDirectory.css';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

const getInitials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

const getStars = (rating) => {
  const rounded = Math.round(Number(rating) || 0);
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
};

const formatReviewDate = (date) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const TeacherProfileModal = ({ teacher, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    Promise.all([
      fetchUserProfile(teacher.user_id),
      fetchUserReviews(teacher.user_id)
    ])
      .then(([profileResponse, reviewsResponse]) => {
        if (!current) return;
        setProfile(profileResponse.data?.user || null);
        setReviews(Array.isArray(reviewsResponse.data) ? reviewsResponse.data.slice(0, 4) : []);
      })
      .catch((error) => console.error('Failed to load teacher profile:', error))
      .finally(() => { if (current) setLoading(false); });

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      current = false;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [teacher.user_id, onClose]);

  const teacherInfo = profile || teacher;

  return (
    <div className="teacher-profile-backdrop" onMouseDown={onClose}>
      <section
        className="teacher-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-profile-name"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="teacher-profile-header">
          <span>Teacher profile</span>
          <button type="button" className="teacher-profile-close" onClick={onClose} aria-label="Close teacher profile">&times;</button>
        </header>

        <div className="teacher-profile-content">
          <div className="teacher-profile-intro">
            <div className="teacher-profile-avatar" style={avatarStyle(teacherInfo.avatar_color)}>{getInitials(teacherInfo.full_name)}</div>
            <div className="teacher-profile-identity">
              <span className="teacher-verified-label">Verified teacher</span>
              <h2 id="teacher-profile-name">{teacherInfo.full_name}</h2>
              <p>{teacherInfo.department || 'Department not listed'}</p>
            </div>
          </div>

          <div className="teacher-profile-stats">
            <div>
              <strong>{Number(teacher.avg_rating || 0).toFixed(1)}</strong>
              <span className="teacher-profile-stars" aria-label={`${Number(teacher.avg_rating || 0).toFixed(1)} out of 5 stars`}>{getStars(teacher.avg_rating)}</span>
              <small>{teacher.review_count} reviews</small>
            </div>
            <div><strong>{teacher.completed_sessions}</strong><small>Sessions completed</small></div>
            <div><strong>{teacher.completed_gigs}</strong><small>Posts completed</small></div>
          </div>

          <section className="teacher-profile-about">
            <h3>About</h3>
            {loading ? <p>Loading profile...</p> : <p>{teacherInfo.bio || 'This teacher has not added a bio yet.'}</p>}
          </section>

          <section className="teacher-profile-reviews">
            <div className="teacher-profile-section-heading">
              <h3>Recent reviews</h3>
              <span>{teacher.review_count}</span>
            </div>
            {loading ? (
              <p className="teacher-profile-muted">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="teacher-profile-muted">No reviews yet.</p>
            ) : (
              <div className="teacher-profile-review-list">
                {reviews.map((review) => (
                  <article className="teacher-profile-review" key={review.review_id}>
                    <div className="teacher-profile-review-top">
                      <strong>{review.reviewer_name || 'Student'}</strong>
                      <span>{formatReviewDate(review.created_at)}</span>
                    </div>
                    <div className="teacher-profile-review-rating" aria-label={`${review.rating} out of 5 stars`}>
                      {getStars(review.rating)} <b>{Number(review.rating).toFixed(1)}</b>
                    </div>
                    {review.comment && <p>{review.comment}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};

const TeacherDirectory = ({ searchQuery = '' }) => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [department, setDepartment] = useState('all');
  const [minimumRating, setMinimumRating] = useState('all');
  const [sortBy, setSortBy] = useState('rating-desc');
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    fetchTeachers()
      .then((response) => {
        if (current) setTeachers(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (current) setLoadError('Teachers could not be loaded. Check the connection and try again.');
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reloadKey]);

  const departments = useMemo(() => (
    [...new Set(teachers.map((teacher) => teacher.department?.trim()).filter(Boolean))].sort(collator.compare)
  ), [teachers]);

  const filteredTeachers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const ratingFloor = minimumRating === 'all' ? 0 : Number(minimumRating);
    const results = teachers.filter((teacher) => {
      const matchesDepartment = department === 'all' || teacher.department === department;
      const matchesRating = Number(teacher.avg_rating || 0) >= ratingFloor;
      const searchableText = [teacher.full_name, teacher.department, teacher.bio].filter(Boolean).join(' ').toLowerCase();
      return matchesDepartment && matchesRating && (!query || searchableText.includes(query));
    });

    const compareRating = (left, right) => Number(left.avg_rating || 0) - Number(right.avg_rating || 0);
    const compareSessions = (left, right) => Number(left.completed_sessions || 0) - Number(right.completed_sessions || 0);
    const compareGigs = (left, right) => Number(left.completed_gigs || 0) - Number(right.completed_gigs || 0);
    results.sort((left, right) => {
      if (sortBy === 'rating-asc') return compareRating(left, right) || collator.compare(left.full_name, right.full_name);
      if (sortBy === 'sessions-desc') return compareSessions(right, left) || compareRating(right, left);
      if (sortBy === 'sessions-asc') return compareSessions(left, right) || compareRating(right, left);
      if (sortBy === 'gigs-desc') return compareGigs(right, left) || compareRating(right, left);
      if (sortBy === 'name-asc') return collator.compare(left.full_name, right.full_name);
      return compareRating(right, left) || Number(right.review_count || 0) - Number(left.review_count || 0);
    });
    return results;
  }, [teachers, searchQuery, department, minimumRating, sortBy]);

  return (
    <section className="teacher-directory" aria-label="Teacher directory">
      <div className="teacher-directory-controls">
        <label>
          <span>Department</span>
          <select value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="all">All departments</option>
            {departments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Minimum rating</span>
          <select value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)}>
            <option value="all">Any rating</option>
            <option value="3">3.0 and up</option>
            <option value="4">4.0 and up</option>
            <option value="4.5">4.5 and up</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="rating-desc">Highest rated</option>
            <option value="rating-asc">Lowest rated</option>
            <option value="sessions-desc">Most sessions completed</option>
            <option value="sessions-asc">Fewest sessions completed</option>
            <option value="gigs-desc">Most tutoring posts completed</option>
            <option value="name-asc">Name A to Z</option>
          </select>
        </label>
      </div>

      <div className="teacher-directory-summary" aria-live="polite">
        <span>{loading ? 'Loading teachers...' : `${filteredTeachers.length} verified teacher${filteredTeachers.length === 1 ? '' : 's'}`}</span>
      </div>

      {loading ? (
        <div className="teacher-directory-state">Loading verified teachers...</div>
      ) : loadError ? (
        <div className="teacher-directory-state teacher-directory-error">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="teacher-directory-state">No teachers match these filters.</div>
      ) : (
        <div className="teacher-directory-grid">
          {filteredTeachers.map((teacher) => (
            <article className="teacher-directory-card" key={teacher.user_id}>
              <div className="teacher-directory-card-top">
                <div className="teacher-directory-avatar" style={avatarStyle(teacher.avatar_color)}>{getInitials(teacher.full_name)}</div>
                <div className="teacher-directory-identity">
                  <h2>{teacher.full_name}</h2>
                  <p>{teacher.department || 'Department not listed'}</p>
                </div>
                <span className="teacher-directory-verified" title="Verified teacher" aria-label="Verified teacher">✓</span>
              </div>

              <p className="teacher-directory-bio">{teacher.bio || 'No introduction added yet.'}</p>

              <div className="teacher-directory-rating">
                <span aria-label={`${Number(teacher.avg_rating || 0).toFixed(1)} out of 5 stars`}>{getStars(teacher.avg_rating)}</span>
                <strong>{Number(teacher.avg_rating || 0).toFixed(1)}</strong>
                <small>({teacher.review_count} reviews)</small>
              </div>

              <div className="teacher-directory-metrics">
                <span><strong>{teacher.completed_sessions}</strong> sessions completed</span>
                <span><strong>{teacher.completed_gigs}</strong> tutoring posts completed</span>
              </div>

              <button type="button" className="teacher-profile-open" onClick={() => setSelectedTeacher(teacher)}>
                View profile
              </button>
            </article>
          ))}
        </div>
      )}

      {selectedTeacher && <TeacherProfileModal teacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} />}
    </section>
  );
};

export default TeacherDirectory;