import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { becomeTeacher } from './api';
import './BecomeTeacher.css';

const BecomeTeacher = ({ user, onUserUpdate, onModeChange }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    student_id: user.student_id || '',
    department: user.department || '',
    expertise: '',
    bio: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const departments = [
    'Computer Science & Engineering',
    'Electrical & Electronic Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Information Technology',
    'Software Engineering',
    'Data Science & AI',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Business Administration',
    'Economics',
    'English',
    'Other'
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const missingField = Object.values(formData).some((value) => !value.trim());

    if (missingField) {
      setError('Please complete every field before continuing.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await becomeTeacher(user.user_id, formData);
      onUserUpdate(response.data.user);
      onModeChange('teacher');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your teacher profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="become-teacher-page">
      <header className="become-teacher-header">
        <button className="become-teacher-back" onClick={() => navigate('/')}>
          <span aria-hidden="true">←</span> Back to Home
        </button>
        <div className="become-teacher-brand"><span>MT</span> MicroTeach</div>
      </header>

      <main className="become-teacher-main">
        <div className="become-teacher-intro">
          <span className="become-teacher-eyebrow">TEACHER ONBOARDING</span>
          <h1>Share what you know.</h1>
          <p>Complete your teacher profile so students in your department can find the subjects you teach best.</p>
        </div>

        <form className="become-teacher-form" onSubmit={handleSubmit}>
          {error && <div className="become-teacher-error">{error}</div>}

          <div className="become-teacher-section">
            <h2>Profile details</h2>
            <div className="become-teacher-grid">
              <label>
                Full name
                <input name="full_name" value={formData.full_name} onChange={handleChange} required />
              </label>
              <label>
                Student ID
                <input name="student_id" value={formData.student_id} onChange={handleChange} placeholder="e.g. 21201489" required />
              </label>
              <label>
                Department
                <select name="department" value={formData.department} onChange={handleChange} required>
                  <option value="">Select your department</option>
                  {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="become-teacher-section">
            <h2>Teaching expertise</h2>
            <label>
              Courses you can teach
              <input name="expertise" value={formData.expertise} onChange={handleChange} placeholder="e.g. CSE 221, Data Structures, Algorithms" required />
              <span>Separate multiple courses or subjects with commas.</span>
            </label>
            <label>
              Teacher profile bio
              <textarea name="bio" value={formData.bio} onChange={handleChange} rows="5" placeholder="Tell students about your experience, teaching style, and what you can help them understand." required />
            </label>
          </div>

          <div className="become-teacher-actions">
            <button type="button" className="become-teacher-cancel" onClick={() => navigate('/')}>Cancel</button>
            <button type="submit" className="become-teacher-submit" disabled={saving}>{saving ? 'Creating profile...' : 'Create Teacher Profile'}</button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default BecomeTeacher;
