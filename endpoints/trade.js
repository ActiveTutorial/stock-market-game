const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

class Stock {
    async getTotalSharesBought() {
        const { rows } = await db.query('SELECT totalSharesBought FROM stock FOR UPDATE');
        return rows[0].totalsharesbought;
    }

    async setTotalSharesBought(totalSharesBought) {
        await db.query('UPDATE stock SET totalSharesBought = $1', [totalSharesBought]);
    }

    async getPrice() {
        const totalSharesBought = await this.getTotalSharesBought();
        if (totalSharesBought >= 1) throw new Error("Shares exceed limit");
        return (1 / (1 - totalSharesBought) ** 2) - 1;
    }

    async stockBuyWorth(budget) {
        const price = await this.getPrice();
        const newPrice = price + budget;
        const totalSharesBought = await this.getTotalSharesBought();
        return 1 - Math.sqrt(1 / (newPrice + 1)) - totalSharesBought;
    }

    async stockSellWorth(budget) {
        const price = await this.getPrice();
        const newPrice = price - budget;
        const totalSharesBought = await this.getTotalSharesBought();
        return totalSharesBought - (1 - Math.sqrt(1 / (newPrice + 1)));
    }

    async buy(budget) {
        const client = await db.query('BEGIN');
        try {
            const totalSharesBought = await this.getTotalSharesBought();
            const sharesToBuy = await this.stockBuyWorth(budget);
            const newTotalShares = totalSharesBought + sharesToBuy;

            await db.query('UPDATE stock SET totalSharesBought = $1', [newTotalShares]);

            const price = await this.getPrice();
            await db.query('COMMIT');
            return { totalSharesBought: newTotalShares, price };
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    }

    async sell(budget) {
        const client = await db.query('BEGIN');
        try {
            const totalSharesBought = await this.getTotalSharesBought();
            const sharesToSell = await this.stockSellWorth(budget);
            const newTotalShares = totalSharesBought - sharesToSell;

            await db.query('UPDATE stock SET totalSharesBought = $1', [newTotalShares]);

            const price = await this.getPrice();
            await db.query('COMMIT');
            return { totalSharesBought: newTotalShares, price };
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    }
}

const stock = new Stock();

async function buyStock(budget, userId) {
    const client = await db.query('BEGIN');
    try {
        const { rows } = await db.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (rows.length === 0) throw new Error("User not found");
        if (rows[0].balance < budget) throw new Error("Insufficient funds");

        await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [budget, userId]);

        const result = await stock.buy(budget);

        await db.query('COMMIT');
        return result;
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    }
}

async function sellStock(budget, userId) {
    const client = await db.query('BEGIN');
    try {
        const result = await stock.sell(budget);

        await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [budget, userId]);

        await db.query('COMMIT');
        return result;
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    }
}

router.post('/buy', async (req, res) => {
    try {
        const { budget, user } = req.body;
        const { id, password } = user;

        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(401).json({ error: 'Unauthorized' });

        const validPassword = await bcrypt.compare(password, rows[0].password);
        if (!validPassword) return res.status(401).json({ error: 'Unauthorized' });

        const stockData = await buyStock(budget, id);
        res.json(stockData);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/sell', async (req, res) => {
    try {
        const { budget, user } = req.body;
        const { id, password } = user;

        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(401).json({ error: 'Unauthorized' });

        const validPassword = await bcrypt.compare(password, rows[0].password);
        if (!validPassword) return res.status(401).json({ error: 'Unauthorized' });

        const stockData = await sellStock(budget, id);
        res.json(stockData);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
