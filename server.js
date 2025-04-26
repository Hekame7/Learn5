import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Funkcja pobierająca losowy artykuł z Wikipedii z kategorii
async function getFactFromCategory(category) {
  const endpoint = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmlimit=50&format=json`;

  const response = await fetch(endpoint);
  const data = await response.json();

  if (!data.query || !data.query.categorymembers || data.query.categorymembers.length === 0) {
    throw new Error('Brak artykułów w tej kategorii');
  }

  // Losowo wybierz jedną stronę
  const randomPage = data.query.categorymembers[Math.floor(Math.random() * data.query.categorymembers.length)];

  // Teraz pobierz streszczenie wybranej strony
  const summaryEndpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(randomPage.title)}`;

  const summaryResponse = await fetch(summaryEndpoint);
  const summaryData = await summaryResponse.json();

  return {
    title: summaryData.title,
    fact: summaryData.extract,
    source: summaryData.content_urls.desktop.page,
    date: new Date().toISOString(),
  };
}

// Funkcja pobierająca losowy artykuł (bez kategorii)
async function getRandomFact() {
  const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
  const data = await response.json();
  return {
    title: data.title,
    fact: data.extract,
    source: data.content_urls.desktop.page,
    date: new Date().toISOString(),
  };
}

// Endpoint: dynamicznie pobiera ciekawostkę
app.get('/fact', async (req, res) => {
  const { category } = req.query;

  try {
    if (category) {
      const fact = await getFactFromCategory(category);
      res.json(fact);
    } else {
      const fact = await getRandomFact();
      res.json(fact);
    }
  } catch (error) {
    console.error('Błąd podczas pobierania ciekawostki:', error);
    res.status(500).json({ error: 'Nie udało się pobrać ciekawostki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
