const express = require('express');
const app = express();
app.use(express.json());

const VALID_TOKEN = 'test-bearer-token-xyz';
let items = [
  { id: 1, name: 'Apple', price: 1.50 },
  { id: 2, name: 'Banana', price: 0.75 },
];
let nextId = 3;

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    return res.json({ token: VALID_TOKEN });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

function requireAuth(req, res, next) {
  if (req.headers.authorization === `Bearer ${VALID_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/items', requireAuth, (req, res) => res.json(items));

app.post('/items', requireAuth, (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  const item = { id: nextId++, name, price };
  items.push(item);
  res.status(201).json(item);
});

app.listen(3002, () => console.log('Auth API at http://localhost:3002'));
