const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get all skills
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        skill_id,
        skill_name,
        category
      FROM Skills
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add a new skill
router.post('/', async (req, res) => {
  const { skill_name, category } = req.body;

  if (!skill_name) {
    return res.status(400).json({ message: 'Skill name is required.' });
  }

  try {
    const query = `
      INSERT INTO Skills
        (skill_name, category)
      VALUES
        (?, ?)
    `;
    const [result] = await db.query(query, [
      skill_name,
      category || 'General'
    ]);
    res.status(201).json({ message: 'Skill added successfully!', skillId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
