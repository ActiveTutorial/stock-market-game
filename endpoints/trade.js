const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');

const dbi = {
    getTotalSharesBought: async function() {
        // Query the database for the total shares bought
        const { rows } = await db.query('SELECT totalSharesBought FROM stock FOR UPDATE');
        return rows[0].totalsharesbought;
    },
    setTotalSharesBought: async function(totalSharesBought) {
        // Update the total shares bought in the database
        await db.query('UPDATE stock SET totalSharesBought = $1', [totalSharesBought]);
        return totalSharesBought;
    },
    transaction: async function(callback) {
        await db.query('BEGIN');
        try {
            const result = await callback();
            await db.query('COMMIT');
            return result;
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    },
    fetchUser: async function(id) {
        // Fetch a user from the database
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        return rows[0];
    },
    setUser: async function(id, balance, stocksOwned) {
        // Update the user's balance and stocks owned in the database
        await db.query('UPDATE users SET balance = $1, stocksowned = $2 WHERE id = $3', [balance, stocksOwned, id]);
    }
};

class Stock {
    async getTotalSharesBought() {
        return dbi.getTotalSharesBought();
    }

    async setTotalSharesBought(totalSharesBought) {
        return dbi.setTotalSharesBought(totalSharesBought);
    }

    async getPrice() {
        // The "price" is the value of the entire share, but this is just for when the part of the share is infinitely small
        const totalSharesBought = await this.getTotalSharesBought();
        if (totalSharesBought >= 1) { // There can never be 100% shares bought
            console.error("Fatal error: Shares exceed limit, FIX IMMEDIATELY!!!!!!!!");
            throw new Error("Shares exceed limit");
        }
        // Price increases asympotically as total shares bought approaches 1
        return (1 / (1 - totalSharesBought) ** 2) - 1;
    }

    async stockBuyWorth(budget) {
        // Actual worth for shares when buying
        const price = await this.getPrice();
        // Introducing money should increase the worth of the share
        const newPrice = price + budget;
        const totalSharesBought = await this.getTotalSharesBought();
        // This is a solved integral, in its un-integrated form its an infinite sum with a limit
        return 1 - Math.sqrt(1 / (newPrice + 1)) - totalSharesBought;
    }

    async stockSellWorth(budget) {
        // Actual worth for shares when selling, diffrerent from buying
        const price = await this.getPrice();
        const newPrice = price - budget;
        const totalSharesBought = await this.getTotalSharesBought();
        return totalSharesBought - (1 - Math.sqrt(1 / (newPrice + 1)));
    }

    async buy(budget) {
        // Transaction to ensure that everything is consistent
        return dbi.transaction(async () => {
            // Fetch total shares bought and worth of budget
            const totalSharesBought = await this.getTotalSharesBought();
            const sharesToBuy = await this.stockBuyWorth(budget);
            const newTotalShares = totalSharesBought + sharesToBuy;

            // Update the total shares bought
            await this.setTotalSharesBought(newTotalShares);

            // Fetch the price of the share
            const price = await this.getPrice();
            // Return the new total shares bought, the price of the share and the amount of share bought
            return { totalSharesBought: newTotalShares, price, sharesToBuy };
        });
    }

    async sell(budget) {
        // Transaction to ensure that everything is consistent
        return dbi.transaction(async () => {
            // Fetch total shares bought and worth of budget
            const totalSharesBought = await this.getTotalSharesBought();
            let sharesToSell = await this.stockSellWorth(budget);

            // Check how many shares the user has
            const { stocksOwned, balance } = await dbi.fetchUser(this.userId);
            // If user wants to sell more shares than they have, sell all shares
            if (stocksOwned < sharesToSell) {
                sharesToSell = stocksOwned;
            }

            // Update the total shares bought
            const newTotalShares = totalSharesBought - sharesToSell;
            await this.setTotalSharesBought(newTotalShares);
            
            const price = await this.getPrice();

            // Return the new total shares bought, the price of the share and the amount of share sold,
            // the amount of shares the user has left, and the user's balance
            return { totalSharesBought: newTotalShares, price, sharesToSell, stocksOwned, balance };
        });
    }
}

const stock = new Stock(); // Create the stock object
let userId = null;

async function buyStock(budget) {
    return dbi.transaction(async () => {
        const user = await dbi.fetchUser(userId);
        console.table({userId, user});
        if (user === undefined) {
            throw new Error("User not found");
        }
        const balance = user.balance
        // If the user doesn't have enough money, buy as much as possible
        if (balance < budget) {
            budget = balance;
        }

        stock.userId = userId;
        const result = await stock.buy(budget);

        await dbi.setUser(userId, balance - budget, user.stocksowned + result.sharesToBuy);

        return {...result, balance: balance - budget};
    });
}

async function sellStock(budget) {
    return dbi.transaction(async () => {
        const user = await dbi.fetchUser(userId);
        if (user === undefined) {
            throw new Error("User not found");
        }
        const balance = user.balance

        stock.userId = userId;
        const result = await stock.sell(budget);

        await dbi.setUser(userId, balance + budget, user.stocksowned - result.sharesToSell);

        return {...result, balance: balance + budget};
    });
}

module.exports = {
    buy: async (req, res) => {
        try {
            // Extract the budget and user data from the request body
            const { budget, user } = req.body;
            const { id, password } = user;
            userId = id;

            // Authenticate the user
            const fullUser = await dbi.fetchUser(id);
            if (!fullUser) return res.status(401).json({ error: 'Unauthorized' });
            const validPassword = await bcrypt.compare(password, fullUser.password);
            if (!validPassword) return res.status(401).json({ error: 'Unauthorized' });

            // Buy and return the result
            const stockData = await buyStock(budget, id);
            res.json(stockData);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },
    sell: async (req, res) => {
        try {
            // Extract the budget and user data from the request body
            const { budget, user } = req.body;
            const { id, password } = user;
            userId = id;

            // Authenticate the user
            const fullUser = await dbi.fetchUser(id);
            if (!fullUser) return res.status(401).json({ error: 'Unauthorized' });
            const validPassword = await bcrypt.compare(password, fullUser.password);
            if (!validPassword) return res.status(401).json({ error: 'Unauthorized' });

            // Sell and return the result
            const stockData = await sellStock(budget, id);
            res.json(stockData);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },
    look: async (req, res) => {
        try {
            // Extract the budget and user data from the request body
            const { budget, user } = req.body;
            const { id, password } = user;
            userId = id;

            // Get totalSharesBought, price, and user data
            const totalSharesBought = await stock.getTotalSharesBought();
            const price = await stock.getPrice();
            const fullUser = await dbi.fetchUser(userId);
            const balance = fullUser.balance;
            const stocksOwned = fullUser.stocksowned;
            res.json({ totalSharesBought, price, balance, stocksOwned });

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