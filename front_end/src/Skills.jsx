import React, { useState, useEffect } from 'react';
import { fetchSkills, addSkill } from './api';

const Skills = () => {
  const [skills, setSkills] = useState([]);
  const [skillName, setSkillName] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const response = await fetchSkills();
      setSkills(response.data);
    } catch (err) {
      setMessage(`Error loading skills: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addSkill({ 
        skill_name: skillName, 
        category: category 
      });
      setMessage(`Skill "${skillName}" added successfully!`);
      setSkillName('');
      setCategory('');
      loadSkills(); // Refresh the list
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '20px' }}>
      <h2>Skills & Subjects</h2>

      {/* Add Skill Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Skill Name (e.g. DBMS, C++)"
          value={skillName}
          onChange={(e) => setSkillName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Category (e.g. Computer Science, Math)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button type="submit">Add Skill</button>
      </form>

      {message && <p><strong>{message}</strong></p>}

      {/* Skills Table */}
      {loading ? (
        <p>Loading skills...</p>
      ) : skills.length === 0 ? (
        <p>No skills added yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '8px' }}>ID</th>
              <th style={{ padding: '8px' }}>Skill Name</th>
              <th style={{ padding: '8px' }}>Category</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => (
              <tr key={skill.skill_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{skill.skill_id}</td>
                <td style={{ padding: '8px' }}>{skill.skill_name}</td>
                <td style={{ padding: '8px' }}>{skill.category || 'General'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Skills;