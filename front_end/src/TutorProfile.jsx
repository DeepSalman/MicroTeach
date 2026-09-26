import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchUserProfile, fetchUserRating, fetchUserReviews } from './api';
import ChatModal from './ChatModal';
import './TutorProfile.css';

const TutorProfile = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState({ avg_rating: 0, review_count: 0 });

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const [profileResponse, reviewsResponse, ratingResponse] = await Promise.all([
          fetchUserProfile(userId),
          fetchUserReviews(userId).catch(() => ({ data: [] })),
          fetchUserRating(userId).catch(() => ({ data: { avg_rating: 0, review_count: 0 } }))
        ]);
        if (!cancelled) {
          setProfile(profileResponse.data);
          setReviews(reviewsResponse.data || []);
          setRating(ratingResponse.data || { avg_rating: 0, review_count: 0 });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.response?.data?.message || 'Could not load this tutor profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return <main className="tutor-profile-state">Loading tutor profile...</main>;
  }

  if (error || !profile?.user) {
    return (
      <main className="tutor-profile-state">
        <p>{error || 'Tutor profile not found.'}</p>
        <button type="button" onClick={() => navigate('/')}>Back to Home</button>
      </main>
    );
  }

  const tutor = profile.user;
  const isTutor = tutor.role === 'tutor' || tutor.role === 'both';
  const posts = profile.posts || [];
  const expertise = (tutor.expertise || '').split(',').map((item) => item.trim()).filter(Boolean);
  const memberSince = tutor.created_at
    ? new Date(tutor.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })
    : 'Campus member';

  if (!isTutor) {
    return (
      <main className="tutor-profile-state">
        <p>This member is not an approved tutor.</p>
        <button type="button" onClick={() => navigate('/')}>Back to Home</button>
      </main>
    );
  }

  return (
    <div className="tutor-profile-page">
      <header className="tutor-profile-header">
        <button type="button" className="tutor-profile-brand" onClick={() => navigate('/')} aria-label="MicroTeach home">
          <img src="/logo.png" alt="MicroTeach" />
        </button>
        <button type="button" className="tutor-profile-back" onClick={() => navigate('/')}>Home</button>
      </header>

      <main className="tutor-profile-main">
        <nav className="tutor-profile-breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate('/')}>Home</button>
          <span>/</span>
          <span>Tutors</span>
          <span>/</span>
          <strong>{tutor.full_name}</strong>
        </nav>

        <section className="tutor-profile-hero">
          <div className="tutor-profile-hero-main">
            <div className="tutor-profile-avatar" aria-hidden="true">
              {(tutor.full_name || 'T').charAt(0).toUpperCase()}
            </div>
            <div className="tutor-profile-summary">
              <div className="tutor-profile-name-row">
                <h1>{tutor.full_name}</h1>
                <span className="tutor-profile-badge">Peer Tutor</span>
                {Number(tutor.is_verified) === 1 && <span className="tutor-profile-verified">Verified</span>}
              </div>
              <p className="tutor-profile-department">{tutor.department ? `Department of ${tutor.department}` : 'Campus community'}</p>
              <div className="tutor-profile-rating">
                <span aria-label={`${Number(rating.avg_rating || 0).toFixed(1)} out of 5 stars`}>
                  {'★'.repeat(Math.round(Number(rating.avg_rating) || 0))}{'☆'.repeat(5 - Math.round(Number(rating.avg_rating) || 0))}
                </span>
                <strong>{Number(rating.avg_rating || 0).toFixed(1)}</strong>
                <span>{rating.review_count || 0} verified reviews</span>
              </div>
            </div>
          </div>
          {String(tutor.user_id) !== String(user.user_id) && (
            <button type="button" className="tutor-profile-message" onClick={() => setChatOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Message Tutor
            </button>
          )}
        </section>

        <section className="tutor-profile-overview" aria-label="Tutor overview">
          <div className="tutor-overview-featured">
            <span>Teaching focus</span>
            <strong>{expertise[0] || tutor.department || 'Peer tutoring'}</strong>
            <small>{expertise.length ? 'Approved areas of expertise' : 'MicroTeach tutor'}</small>
          </div>
          <div><span>Teaching posts</span><strong>{posts.length}</strong><small>Active requests</small></div>
          <div><span>Rating</span><strong>{Number(rating.avg_rating || 0).toFixed(1)} / 5</strong><small>{rating.review_count || 0} reviews</small></div>
          <div><span>Member since</span><strong>{memberSince}</strong><small>MicroTeach campus</small></div>
        </section>

        <div className="tutor-profile-content-grid">
          <div className="tutor-profile-main-column">
            <section className="tutor-profile-section">
              <div className="tutor-profile-section-heading">
                <div><span className="tutor-profile-eyebrow">Introduction</span><h2>About {tutor.full_name.split(' ')[0]}</h2></div>
              </div>
              <p className="tutor-profile-about">{tutor.bio || 'This tutor has not added an introduction yet.'}</p>
            </section>

            <section className="tutor-profile-section">
              <div className="tutor-profile-section-heading">
                <div><span className="tutor-profile-eyebrow">Recent work</span><h2>Teaching Activity</h2></div>
                <span className="tutor-profile-count">{posts.length}</span>
              </div>
              {posts.length ? (
                <div className="tutor-profile-post-list">
                  {posts.map((post) => (
                    <article className="tutor-profile-post" key={post.post_id}>
                      <div className="tutor-profile-post-meta">
                        <span>{post.course_code || post.category}</span>
                        <span className={`tutor-post-status ${post.status}`}>{post.status}</span>
                      </div>
                      <h3>{post.title}</h3>
                      <p>{post.description || 'No additional details provided.'}</p>
                      <div className="tutor-profile-post-footer">
                        <span>{post.delivery_format?.replaceAll('_', ' ') || 'Tutoring session'}</span>
                        <strong>৳{Number(post.bounty || 0).toLocaleString()}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="tutor-profile-empty">No active teaching posts yet.</p>
              )}
            </section>

            <section className="tutor-profile-section">
              <div className="tutor-profile-section-heading">
                <div><span className="tutor-profile-eyebrow">Student feedback</span><h2>Reviews</h2></div>
                <span className="tutor-profile-count">{reviews.length}</span>
              </div>
              {reviews.length ? (
                <div className="tutor-profile-reviews">
                  {reviews.map((review) => (
                    <article className="tutor-profile-review" key={review.review_id}>
                      <div className="tutor-review-avatar">{(review.reviewer_name || '?').charAt(0).toUpperCase()}</div>
                      <div className="tutor-review-body">
                        <div className="tutor-review-heading">
                          <strong>{review.reviewer_name || 'Student'}</strong>
                          <span>{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="tutor-review-stars">{'★'.repeat(Math.round(review.rating))}{'☆'.repeat(5 - Math.round(review.rating))}</div>
                        {review.comment && <p>{review.comment}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="tutor-profile-empty">No reviews yet.</p>
              )}
            </section>
          </div>

          <aside className="tutor-profile-sidebar">
            <section className="tutor-profile-section tutor-profile-details">
              <span className="tutor-profile-eyebrow">Profile details</span>
              <h2>Information</h2>
              <dl>
                <div><dt>Department</dt><dd>{tutor.department || 'Not added'}</dd></div>
                {tutor.student_id && <div><dt>Student ID</dt><dd>{tutor.student_id}</dd></div>}
                {tutor.email && <div><dt>Email</dt><dd><a href={`mailto:${tutor.email}`}>{tutor.email}</a></dd></div>}
                {tutor.phone && <div><dt>Phone</dt><dd><a href={`tel:${tutor.phone}`}>{tutor.phone}</a></dd></div>}
                <div><dt>Joined</dt><dd>{memberSince}</dd></div>
              </dl>
            </section>

            <section className="tutor-profile-section tutor-profile-expertise">
              <span className="tutor-profile-eyebrow">Tutor application</span>
              <h2>Areas of Expertise</h2>
              {expertise.length ? (
                <div className="tutor-expertise-list">{expertise.map((item) => <span key={item}>{item}</span>)}</div>
              ) : (
                <p className="tutor-profile-empty">No expertise areas listed.</p>
              )}
            </section>
          </aside>
        </div>
      </main>

      {chatOpen && (
        <ChatModal
          user={user}
          startWithUserId={tutor.user_id}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
};

export default TutorProfile;
