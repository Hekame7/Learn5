import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:19006',   // Jeśli testujesz na Expo Go lokalnie
  'https://learn5.onrender.com',  // Twój backend Render.com
  '*' // Tymczasowo zezwalamy wszystkim na testy
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Funkcja pobierająca ciekawostkę na podstawie tematu od AI
async function getFactFromAI(topic) {
  const prompt = `
Twoim zadaniem jest stworzenie krótkiej ciekawostki o temacie "${topic}".
`;

const response = await fetch('https://api-inference.huggingface.co/models/EleutherAI/gpt-j-6B', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt
    }),
  });

  if (!response.ok) {
    throw new Error(`Błąd w komunikacji z AI: ${response.status}`);
  }

  const data = await response.json();

  if (!data || !data[0] || !data[0].generated_text) {
    throw new Error('Brak poprawnej odpowiedzi od AI');
  }

  const generatedText = data[0].generated_text.trim();

  // Zamiast próbować parsować JSON, po prostu pakujemy odpowiedź do własnej struktury
  return {
    title: `Ciekawostka o: ${topic}`,
    fact: generatedText,
    source: "https://pl.wikipedia.org",
    date: new Date().toISOString(),
  };
}

// Endpoint: pobieranie ciekawostki
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    const fact = await getFactFromAI(topic);
    res.json(fact);
  } catch (error) {
    console.error('Błąd podczas pobierania ciekawostki od AI:', error);
    res.status(500).json({ error: 'Nie udało się wygenerować ciekawostki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
