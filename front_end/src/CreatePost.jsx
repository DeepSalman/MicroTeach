import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost, fetchWalletBalance } from './api';
import './CreatePost.css';

const getMinimumDeadline = () => {
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDateTime.toISOString().slice(0, 16);
};

const CreatePost = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    category: 'Algorithms & DS',
    courseName: 'Algorithms & Data Structures',
    courseCode: 'CSE 221',
    title: '',
    description: '',
    deliveryFormat: 'live_call',
    bounty: 350,
    deadline: '',
    isUrgent: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [minimumDeadline] = useState(getMinimumDeadline);

  useEffect(() => {
    if (user?.user_id) {
      fetchWalletBalance(user.user_id)
        .then(res => setWalletBalance(res.data.balance || 0))
        .catch(() => {});
    }
  }, [user]);

  const categories = [
    { name: 'Algorithms & DS', courseName: 'Algorithms & Data Structures', code: 'CSE 221', icon: '📊' },
    { name: 'Calculus & Math', courseName: 'Calculus & Mathematics', code: 'MTH 201', icon: '∑' },
    { name: 'Physics & Lab', courseName: 'Physics', code: 'PHY 102', icon: '⚛' },
    { name: 'System Architecture', courseName: 'Computer Architecture', code: 'CSE 331', icon: '⚙' },
    { name: 'Circuits & EEE', courseName: 'Electrical & Electronic Engineering', code: 'EEE 163', icon: '⚡' },
    { name: 'Others', courseName: '', code: '', icon: '📌' }
  ];

  const deliveryOptions = [
    { id: 'live_call', name: 'Live Micro-Call', desc: '15-30 min interactive whiteboard via Google Meet or Discord voice.', badge: 'Google Meet (30m)', icon: '📹', tag: 'Fastest resolution' },
    { id: 'annotated_pdf', name: 'Annotated PDF', desc: 'Hand-drawn diagrams, commented code segments, and logic breakdown.', badge: 'Annotated Notes', icon: '✏️', tag: 'Asynchronous review' },
    { id: 'video_walkthrough', name: 'Video Walkthrough', desc: '5-10 min screen recording explaining step-by-step logic & proof.', badge: 'Video Walkthrough', icon: '🎬', tag: 'Self-paced replay' }
  ];

  const bountyAmount = parseFloat(formData.bounty) || 0;
  const insufficientBalance = bountyAmount > 0 && bountyAmount > walletBalance;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleCategorySelect = (cat) => {
    setFormData({
      ...formData,
      category: cat.name,
      courseName: cat.courseName,
      courseCode: cat.code
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Please enter a problem title.');
      return;
    }

    if (!formData.courseName.trim() || !formData.courseCode.trim()) {
      setError('Please enter a course name and course code.');
      return;
    }

    const deadlineTime = Date.parse(formData.deadline);
    if (formData.deadline && (!Number.isFinite(deadlineTime) || deadlineTime <= Date.now())) {
      setError('The deadline must be in the future.');
      return;
    }

    const bountyAmount = parseFloat(formData.bounty) || 0;
    if (bountyAmount > 0 && bountyAmount > walletBalance) {
      setError(`Insufficient wallet balance. Your balance is ৳${walletBalance.toFixed(2)}, but the bounty is ৳${bountyAmount.toFixed(2)}. Please top up your wallet.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createPost({
        user_id: user.user_id,
        category: formData.category,
        course_code: `${formData.courseCode.trim()} - ${formData.courseName.trim()}`,
        title: formData.title,
        description: formData.description,
        delivery_format: formData.deliveryFormat,
        bounty: formData.bounty,
        deadline: formData.deadline,
        is_urgent: formData.isUrgent
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-page">
      <div className="create-post-container">
        
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="breadcrumb-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Listings
          </a>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Post an Academic Problem & Bounty</span>
        </div>

        {/* Header */}
        <div className="create-post-header">
          <div>
            <h1>Post an Academic Problem & Bounty</h1>
            <p>Verified peer tutors and TAs across your campus will review your roadblock and pitch solutions within minutes. Escrow funds stay secure until you resolve the issue.</p>
          </div>
          <div className="online-badge">
            <span className="online-dot"></span>
            142 Peer Tutors Online Now
          </div>
        </div>

        {error && <div className="create-post-error">{error}</div>}

        <form onSubmit={handleSubmit} className="create-post-form">
          
          {/* Section 1: Category */}
          <div className="form-section">
            <div className="section-header">
              <label>
                <span className="section-icon">📁</span>
                Discipline & Domain
              </label>
              <span className="step-label">Step 1 of 5</span>
            </div>
            <div className="category-pills">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  className={`cat-pill ${formData.category === cat.name ? 'active' : ''}`}
                  onClick={() => handleCategorySelect(cat)}
                >
                  <span>{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Course & Title */}
          <div className="form-section">
            <div className="section-header">
              <label>
                <span className="section-icon">🎓</span>
                Course Code & Problem Headline
              </label>
              <span className="step-label">Step 2 of 5</span>
            </div>
            <div className="form-grid">
              <div className="form-grid course-details-grid">
                <div className="form-field">
                  <label className="field-label">Course Code</label>
                  <input
                    type="text"
                    name="courseCode"
                    className="form-input"
                    placeholder="e.g. CSE 221"
                    value={formData.courseCode}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Course Name</label>
                  <input
                    type="text"
                    name="courseName"
                    className="form-input"
                    placeholder="e.g. Algorithms and Data Structures"
                    value={formData.courseName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="form-field">
              <div className="field-label-row">
                <label className="field-label">Problem Title / Core Roadblock</label>
                <span className="char-count">{formData.title.length} / 120 chars</span>
              </div>
              <input
                type="text"
                name="title"
                className="form-input"
                maxLength="120"
                placeholder="Summarize your exact bottleneck clearly..."
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Section 3: Description */}
          <div className="form-section">
            <div className="section-header">
              <label>
                <span className="section-icon">📝</span>
                Detailed Roadblock Description
              </label>
              <span className="step-label">Step 3 of 5</span>
            </div>
            <div className="form-field">
              <textarea
                name="description"
                className="form-textarea"
                rows="6"
                placeholder={"Explain:\n1. What theoretical approach did you attempt?\n2. Exact error log, segmentation fault or infinite loop trace.\n3. What specific conceptual bridge do you need help understanding?"}
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Section 4: Delivery Format */}
          <div className="form-section">
            <div className="section-header">
              <label>
                <span className="section-icon">💬</span>
                Preferred Resolution Format
              </label>
              <span className="step-label">Step 4 of 5</span>
            </div>
            <div className="delivery-options">
              {deliveryOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`delivery-option ${formData.deliveryFormat === opt.id ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, deliveryFormat: opt.id })}
                >
                  <div className="delivery-header">
                    <div className={`delivery-icon ${formData.deliveryFormat === opt.id ? 'active' : ''}`}>
                      {opt.icon}
                    </div>
                    <span className="delivery-check">
                      {formData.deliveryFormat === opt.id ? '✓' : '○'}
                    </span>
                  </div>
                  <h4>{opt.name}</h4>
                  <p>{opt.desc}</p>
                  <div className={`delivery-tag ${formData.deliveryFormat === opt.id ? 'active' : ''}`}>
                    {opt.tag}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Bounty & Deadline */}
          <div className="form-section">
            <div className="section-header">
              <label>
                <span className="section-icon">💰</span>
                Bounty Allocation & Deadline
              </label>
              <span className="step-label">Step 5 of 5</span>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">Target Resolution Deadline</label>
                <input
                  type="datetime-local"
                  name="deadline"
                  className="form-input"
                  min={minimumDeadline}
                  value={formData.deadline}
                  onChange={handleChange}
                />
                <span className="field-hint">Choose the date and time tutors must deliver by.</span>
              </div>
              <div className="form-field">
                <label className="field-label">Escrow Bounty (৳ BDT)</label>
                <div className="wallet-balance-display">
                  <span className="wallet-label">Your Balance:</span>
                  <span className={`wallet-amount ${walletBalance < (parseFloat(formData.bounty) || 0) ? 'insufficient' : ''}`}>
                    ৳{Number(walletBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bounty-input">
                  <span className="bounty-symbol">৳</span>
                  <input
                    type="number"
                    name="bounty"
                    className={`form-input bounty-field ${bountyAmount > walletBalance ? 'bounty-exceeds' : ''}`}
                    min="100"
                    max="5000"
                    step="50"
                    value={formData.bounty}
                    onChange={handleChange}
                  />
                </div>
                {parseFloat(formData.bounty) > walletBalance && (
                  <span className="field-hint insufficient-hint">
                    Insufficient balance. Please top up your wallet.
                  </span>
                )}
                {parseFloat(formData.bounty) <= walletBalance && (
                  <span className="field-hint">Typical accepted bounty: ৳250 – ৳450</span>
                )}
              </div>
            </div>

            {/* Urgency Toggle */}
            <div className="urgency-box" onClick={() => setFormData({ ...formData, isUrgent: !formData.isUrgent })}>
              <input
                type="checkbox"
                checked={formData.isUrgent}
                onChange={handleChange}
                name="isUrgent"
                className="urgency-checkbox"
              />
              <div>
                <label className="urgency-label">
                  🔥 Mark as High Urgency (&lt; 4 hours)
                  <span className="urgency-badge">+Push Notification</span>
                </label>
                <p className="urgency-desc">Sends instant SMS and in-app alerts to verified 4.9+ star peer tutors currently on campus standby.</p>
              </div>
            </div>

            {/* Escrow Guarantee */}
            <div className="escrow-guarantee">
              <span className="escrow-icon">🛡️</span>
              <div>
                <span className="escrow-title">100% MicroTeach Campus Escrow Guarantee</span>
                <p className="escrow-desc">Funds are held in neutral campus reserve. You inspect the explanation code and approve the session before any funds are released to the peer tutor.</p>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="form-actions">
            <button type="button" className="btn-save-draft" onClick={() => navigate('/')}>
              Save Draft
            </button>
            <button type="submit" className="btn-publish" disabled={loading || insufficientBalance}>
              {loading ? 'Publishing...' : insufficientBalance ? 'Insufficient Balance' : 'Publish Problem Card'}
              <span>→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePost;
