import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost, fetchWalletBalance } from './api';
import './CreatePost.css';

const CreatePost = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    category: 'University Level',
    title: '',
    description: '',
    deliveryFormat: 'live_call',
    bounty: 0,
    deadlineDate: '',
    deadlineTime: '',
    isUrgent: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (user?.user_id) {
      fetchWalletBalance(user.user_id)
        .then(res => setWalletBalance(res.data.balance || 0))
        .catch(() => {});
    }
  }, [user]);

  const domains = ['University Level', 'HSC Level', 'SSC Level'];

  const deliveryOptions = [
    { id: 'live_call', name: 'Live Micro-Call', desc: '15-30 min live session with a shared whiteboard.' },
    { id: 'annotated_pdf', name: 'Annotated PDF', desc: 'Marked-up diagrams, commented code, and a written breakdown.' },
    { id: 'video_walkthrough', name: 'Video Walkthrough', desc: 'A 5-10 min screen recording walking through the solution.' }
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Please enter a problem title.');
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
        course_code: '',
        title: formData.title,
        description: formData.description,
        delivery_format: formData.deliveryFormat,
        bounty: formData.bounty || 0,
        deadline: formData.deadlineDate
          ? `${formData.deadlineDate}T${formData.deadlineTime || '23:59'}`
          : '',
        is_urgent: formData.isUrgent ? 1 : 0
      });
      navigate('/');
    } catch (err) {
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to create post. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-page">
      <div className="create-post-container">
        
        {/* Top back button */}
        <button type="button" className="btn-back btn-back-top" onClick={() => navigate('/')}>
          &larr; Back
        </button>

        {/* Header */}
        <div className="create-post-header">
          <div>
            <h1>Post an Academic Problem</h1>
          </div>
        </div>

        {error && <div className="create-post-error">{error}</div>}

        <form onSubmit={handleSubmit} className="create-post-form">
          
          {/* Section 1: Domain */}
          <div className="form-section">
            <div className="section-header">
              <label>Domain</label>
              <span className="step-label">Step 1 of 5</span>
            </div>
            <div className="category-pills">
              {domains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  className={`cat-pill ${formData.category === domain ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, category: domain })}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Problem Headline */}
          <div className="form-section">
            <div className="section-header">
              <label>Problem Headline</label>
              <span className="step-label">Step 2 of 5</span>
            </div>
            <div className="form-field">
              <div className="field-label-row">
                <label className="field-label">Problem Title</label>
                <span className="char-count">{formData.title.length} / 120 chars</span>
              </div>
              <input
                type="text"
                name="title"
                className="form-input"
                maxLength="120"
                placeholder="Summarize the problem in one line..."
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Section 3: Description */}
          <div className="form-section">
            <div className="section-header">
              <label>Description of the problem</label>
              <span className="step-label">Step 3 of 5</span>
            </div>
            <div className="form-field">
              <textarea
                name="description"
                className="form-textarea"
                rows="6"
                placeholder={"What is the problem, and where exactly are you stuck?\n\n1. What you have tried so far.\n2. The error, proof, or step that blocks you.\n3. What you need explained."}
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Section 4: Resolution Format */}
          <div className="form-section">
            <div className="section-header">
              <label>Resolution Format</label>
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
                    <span className="delivery-check">
                      {formData.deliveryFormat === opt.id ? '✓' : '○'}
                    </span>
                  </div>
                  <h4>{opt.name}</h4>
                  <p>{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Bounty & Deadline */}
          <div className="form-section">
            <div className="section-header">
              <label>Bounty &amp; Deadline</label>
              <span className="step-label">Step 5 of 5</span>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">Target Resolution Deadline</label>
                <div className="deadline-inputs">
                  <input
                    type="date"
                    name="deadlineDate"
                    className="form-input"
                    value={formData.deadlineDate}
                    onChange={handleChange}
                  />
                  <input
                    type="time"
                    name="deadlineTime"
                    className="form-input"
                    value={formData.deadlineTime}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-field">
                <label className="field-label">Escrow Bounty (৳ BDT)</label>
                <div className="wallet-balance-display">
                  <span className="wallet-label">Your Balance:</span>
                  <span className={`wallet-amount ${walletBalance < (parseFloat(formData.bounty) || 0) ? 'insufficient' : ''}`}>
                    ৳{Number(walletBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`bounty-input ${bountyAmount > walletBalance ? 'bounty-exceeds' : ''}`}>
                  <span className="bounty-symbol">৳</span>
                  <input
                    type="number"
                    name="bounty"
                    className="form-input bounty-field"
                    min="0"
                    max="5000"
                    step="50"
                    value={formData.bounty}
                    onChange={handleChange}
                  />
                </div>
                {parseFloat(formData.bounty) > walletBalance && (
                  <span className="field-hint insufficient-hint">
                    Insufficient balance (৳{Number(walletBalance).toFixed(2)}). Set bounty to 0 or top up your wallet in Profile.
                  </span>
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
                  Mark as High Urgency (&lt; 4 hours)
                </label>
              </div>
            </div>

            {/* Escrow Guarantee */}
            <div className="escrow-guarantee">
              <div>
                <span className="escrow-title">Escrow Protection</span>
                <p className="escrow-desc">Your bounty is held until you approve the solution.</p>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="form-actions">
            <button type="button" className="btn-back" onClick={() => navigate('/')}>
              &larr; Back
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
