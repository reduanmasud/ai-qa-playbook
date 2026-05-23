const express = require('express');
const app = express();
app.use(express.json());

function classify(text) {
  const lower = text.toLowerCase();
  if (/happy|great|love/.test(lower)) {
    return { label: 'positive', confidence: 0.9 };
  }
  if (/bad|terrible|hate/.test(lower)) {
    return { label: 'negative', confidence: 0.85 };
  }
  return { label: 'neutral', confidence: 0.6 };
}

app.post('/classify', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text field is required and must be a string' });
  }
  const result = classify(text);
  res.json(result);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3012, () => console.log('Golden dataset demo server at http://localhost:3012'));
