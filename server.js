import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Endpoint: Najnowsza ciekawostka
app.get('/fact', (req, res) => {
  try {
    const facts = JSON.parse(fs.readFileSync('facts.json'));
    const latestFact = facts[facts.length - 1];
    res.json(latestFact);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się odczytać ciekawostki.' });
  }
});

// Endpoint: Wszystkie ciekawostki
app.get('/facts', (req, res) => {
  try {
    const facts = JSON.parse(fs.readFileSync('facts.json'));
    res.json(facts);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się odczytać ciekawostek.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});