const express = require('express');
const app = express();
app.use(express.json());

let items = [
  { id: 1, name: 'Apple', price: 1.50 },
  { id: 2, name: 'Banana', price: 0.75 },
];
let nextId = 3;

app.get('/items', (req, res) => {
  res.json(items);
});

app.post('/items', (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  const item = { id: nextId++, name, price };
  items.push(item);
  res.status(201).json(item);
});

app.delete('/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  items.splice(index, 1);
  res.status(204).send();
});

app.listen(3001, () => console.log('API server at http://localhost:3001'));
