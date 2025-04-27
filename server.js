import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Funkcja generująca ciekawostkę i słowo kluczowe
async function generateFactAndKeyword(topic) {
  const prompt = `
Podany temat: "${topic}".

Twoje zadanie:
- Wymyśl krótką, prawdziwą ciekawostkę na temat związany z tym tematem.
- Wybierz konkretne, ciekawe zagadnienie (np. konkretny gatunek, proces, ciekawy fakt).
- Ciekawostka musi być zgodna z faktami dostępnymi w ogólnodostępnych encyklopediach (Wikipedia, Britannica).
- Odpowiedź zwróć w formacie JSON:
{
  "fact": "Twoja ciekawostka",
  "keyword": "Krótkie hasło do wyszukiwania w encyklopedii"
}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Jesteś pomocnym asystentem generującym prawdziwe ciekawostki na podstawie encyklopedii.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.5,
    max_tokens: 400,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Brak odpowiedzi od OpenAI.');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error('Nie udało się sparsować odpowiedzi OpenAI jako JSON.');
  }

  if (!parsed.fact || !parsed.keyword) {
    throw new Error('Brak ciekawostki lub słowa kluczowego w odpowiedzi.');
  }

  return parsed;
}

// Funkcja szukająca linku w Wikipedii
async function findWikipediaPage(keyword) {
  const searchResponse = await fetch(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(keyword)}&limit=3`);
  if (!searchResponse.ok) {
    throw new Error('Błąd podczas wyszukiwania w Wikipedii.');
  }

  const searchData = await searchResponse.json();
  if (!searchData.pages || searchData.pages.length === 0) {
    throw new Error('Nie znaleziono strony w Wikipedii.');
  }

  // Pobieramy najlepszy wynik
  const bestMatch = searchData.pages[0];
  if (!bestMatch.key) {
    throw new Error('Brak tytułu strony w wynikach wyszukiwania Wikipedii.');
  }

  return `https://en.wikipedia.org/wiki/${encodeURIComponent(bestMatch.key)}`;
}

// Endpoint generujący ciekawostkę
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    const { fact, keyword } = await generateFactAndKeyword(topic);
    const wikiLink = await findWikipediaPage(keyword);

    res.json({
      title: `Ciekawostka o: ${keyword}`,
      fact,
      source: wikiLink,
      date: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Błąd:', error);
    res.status(500).json({ error: 'Nie udało się wygenerować ciekawostki.'
