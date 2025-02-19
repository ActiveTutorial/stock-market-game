const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

class Stock {
    async getTotalSharesBought() {
        const { rows } = await db.query('SELECT totalSharesBought FROM stock FOR UPDATE');
        if (rows[0].totalsharesbought == null) {
            await this.setTotalSharesBought(0.1);
            return 0.1;
        }
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

            await this.setTotalSharesBought(newTotalShares);

            const price = await this.getPrice();
            await db.query('COMMIT');
            return { totalSharesBought: newTotalShares, price, sharesToBuy };
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    }

    async sell(budget) {
        const client = await db.query('BEGIN');
        try {
            const totalSharesBought = await this.getTotalSharesBought();
            let sharesToSell = await this.stockSellWorth(budget);

            // Check how many shares the user has
            const { rows } = await db.query('SELECT stocksowned FROM users WHERE id = $1', [this.userId]);
            if (rows[0].stocksowned < sharesToSell) {
                sharesToSell = rows[0].stocksowned;
            }

            const newTotalShares = totalSharesBought - sharesToSell;

            await this.setTotalSharesBought(newTotalShares);
            
            const price = await this.getPrice();
            await db.query('COMMIT');
            return { totalSharesBought: newTotalShares, price , sharesToSell};
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

        stock.userId = userId;
        const result = await stock.buy(budget);

        await db.query('UPDATE users SET stocksowned = stocksowned + $1 WHERE id = $2', [result.sharesToBuy, userId]);

        await db.query('COMMIT');
        return result;
    } catch (err) {
        await db.query('ROLLBACK');
        console.log(err);
        throw err;
    }
}

async function sellStock(budget, userId) {
    const client = await db.query('BEGIN');
    try {
        const { rows } = await db.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (rows.length === 0) throw new Error("User not found");

        await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [budget, userId]);

        stock.userId = userId;
        const result = await stock.sell(budget);

        await db.query('UPDATE users SET stocksowned = stocksowned - $1 WHERE id = $2', [result.sharesToSell, userId]);

        await db.query('COMMIT');
        return result;
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    }
}

module.exports = {
    buy: async (req, res) => {
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
    },
    sell: async (req, res) => {
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
    }
};


/*
Example fetch request to buy stock:
fetch('/api/trade/buy', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        budget: 100,
        user: {
            id: 1,
            password: 'password'
        }
    }),
})
    .then(response => response.json())
    .then(data => {
        console.log(data);
    });


*/