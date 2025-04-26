import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Funkcja pobierająca losową ciekawostkę z Wikipedii
async function getWikipediaFact() {
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
  try {
    const fact = await getWikipediaFact();
    res.json(fact);
  } catch (error) {
    console.error('Błąd podczas pobierania ciekawostki:', error);
    res.status(500).json({ error: 'Nie udało się pobrać ciekawostki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
