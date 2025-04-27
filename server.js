import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';

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

// Szukanie artykułów OpenSearch EN
async function searchWikipediaOpenSearch(topic) {
  const response = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=50&namespace=0&format=json&origin=*`);
  if (!response.ok) {
    throw new Error('Błąd podczas wyszukiwania przez OpenSearch.');
  }
  const data = await response.json();

  const titles = data[1];
  const descriptions = data[2];
  const urls = data[3];

  if (!titles.length) {
    throw new Error('Brak wyników w OpenSearch.');
  }

  const results = titles.map((title, index) => ({
    title,
    description: descriptions[index],
    url: urls[index],
  }));

  return results;
}

// Pobieranie pełnego streszczenia EN
async function getWikipediaSummary(pageTitle) {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
  if (!response.ok) {
    throw new Error('Błąd podczas pobierania streszczenia.');
  }
  const data = await response.json();
  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls?.desktop?.page || null,
  };
}

// Tłumaczenie na polski przez OpenAI
async function translateToPolish(text) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Jesteś tłumaczem. Tłumacz podany tekst z angielskiego na polski.' },
      { role: 'user', content: text }
    ],
    temperature: 0.3,
    max_tokens: 400,
  });

  return completion.choices[0]?.message?.content?.trim() || text;
}

// Endpoint: /fact
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    const articles = await searchWikipediaOpenSearch(topic);
    const randomArticle = articles[Math.floor(Math.random() * articles.length)];

    let lessonSummary = randomArticle.description;

    if (!lessonSummary) {
      const { extract } = await getWikipediaSummary(randomArticle.title);
      lessonSummary = extract || 'Brak dostępnego streszczenia.';
    }

    const translatedSummary = await translateToPolish(lessonSummary);

    res.json({
      lessonTitle: `Czego możesz się nauczyć o: ${randomArticle.title}`,
      lessonSummary: translatedSummary,
      source: randomArticle.url,
      date: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Błąd:', error);
    res.status(500).json({ error: error.message || 'Nie udało się pobrać materiału do nauki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
