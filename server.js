import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

// Szukanie artykułów w Wikipedii przez OpenSearch
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

// Endpoint: /fact
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    const articles = await searchWikipediaOpenSearch(topic);
    const randomArticle = articles[Math.floor(Math.random() * articles.length)];

    res.json({
      lessonTitle: `Czego możesz się nauczyć o: ${randomArticle.title}`,
      lessonSummary: randomArticle.description || 'Brak krótkiego opisu.',
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
