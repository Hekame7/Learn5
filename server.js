import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Konfiguracja CORS
const allowedOrigins = [
  'http://localhost:19006',
  'https://learn5.onrender.com',
  '*'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Inicjalizacja klienta OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // musi być ustawione w .env
});

// Funkcja pobierająca ciekawostkę z OpenAI
async function getFactFromAI(topic) {
  const prompt = `Napisz krótką, ciekawą ciekawostkę na temat: "${topic}". Odpowiedź powinna być zwięzła, interesująca i zawierać 1-2 zdania.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // Możesz zmienić na "gpt-4" jeśli chcesz
    messages: [
      { role: 'system', content: 'Jesteś pomocnym asystentem generującym ciekawostki.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7, // trochę kreatywności
    max_tokens: 200,  // ograniczamy długość odpowiedzi
  });

  const generatedText = completion.choices[0]?.message?.content?.trim();

  if (!generatedText) {
    throw new Error('Brak wygenerowanej odpowiedzi od OpenAI.');
  }

  return {
    title: `Ciekawostka o: ${topic}`,
    fact: generatedText,
    source: "OpenAI",
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
    console.error('Błąd podczas pobierania ciekawostki od OpenAI:', error);
    res.status(500).json({ error: 'Nie udało się wygenerować ciekawostki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
