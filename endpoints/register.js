const { body, validationResult } = require('express-validator');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

router.post(
    '/register',
    [
        body('username').isLength({ min: 3 }).trim().escape(),
        body('password').isLength({ min: 6 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const { username, password } = req.body;

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            const { rows } = await db.query(
                'INSERT INTO users (username, password, balance) VALUES ($1, $2, $3) RETURNING id',
                [username, hashedPassword, 1000.0] // New accounts start with $1000
            );

            res.json({ message: 'Account created', userId: rows[0].id });
        } catch (err) {
            if (err.code === '23505') {
                return res.status(400).json({ error: 'Username already taken' });
            }
            res.status(500).json({ error: 'Server error' });
        }
    }
);

module.exports = router;
