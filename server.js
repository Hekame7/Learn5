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

// Szukamy artykułów za pomocą pełnotekstowego wyszukiwania
async function searchWikipediaFullText(topic) {
  const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=50&format=json&origin=*`);
  if (!response.ok) {
    throw new Error('Błąd podczas pełnotekstowego wyszukiwania w Wikipedii.');
  }
  const data = await response.json();
  if (!data.query.search || data.query.search.length === 0) {
    throw new Error('Brak wyników w pełnotekstowym wyszukiwaniu Wikipedii.');
  }
  return data.query.search; // Lista artykułów
}

// Pobieramy streszczenie artykułu
async function getWikipediaSummary(pageTitle) {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
  if (!response.ok) {
    throw new Error('Błąd podczas pobierania streszczenia z Wikipedii.');
  }
  const data = await response.json();
  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls?.desktop?.page || null,
  };
}

// Opcjonalnie: Formatujemy streszczenie przez AI
async function formatSummaryWithAI(summary) {
  const prompt = `
Twoje zadanie: przeredaguj poniższe streszczenie w formie jednej ciekawej, łatwej do zapamiętania ciekawostki lub krótkiego faktu.

Tekst:
"${summary}"

Twoja odpowiedź:
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Jesteś pomocnym edytorem treści edukacyjnych.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.5,
    max_tokens: 200,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  return content || summary; // Jeśli coś pójdzie nie tak, zwróć oryginał
}

// Endpoint: /fact
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    const articles = await searchWikipediaFullText(topic);
    const randomArticle = articles[Math.floor(Math.random() * articles.length)];

    const { title, extract, url } = await getWikipediaSummary(randomArticle.title);

    if (!extract) {
      throw new Error('Brak streszczenia dla wybranego artykułu.');
    }

    const formattedFact = await formatSummaryWithAI(extract);

    res.json({
      title: title,
      fact: formattedFact,
      source: url,
      date: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Błąd:', error);
    res.status(500).json({ error: error.message || 'Nie udało się pobrać faktu.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
