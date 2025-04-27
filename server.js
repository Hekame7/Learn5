import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Funkcja pobierająca losowy artykuł z polskiej Wikipedii z kategorii
async function getFactFromCategory(category) {
  const endpoint = `https://pl.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Kategoria:${encodeURIComponent(category)}&cmlimit=50&format=json`;

  const response = await fetch(endpoint);
  const data = await response.json();

  if (!data.query || !data.query.categorymembers || data.query.categorymembers.length === 0) {
    throw new Error('Brak artykułów w tej kategorii');
  }

	// Filtrowanie tylko artykułów (ns === 0)
	const articles = data.query.categorymembers.filter(page => page.ns === 0);

	if (articles.length === 0) {
	  throw new Error('Brak artykułów w tej kategorii');
	}

	// Losowo wybierz jeden artykuł z przefiltrowanej listy
	const randomPage = articles[Math.floor(Math.random() * articles.length)];

  // Teraz pobierz streszczenie wybranej strony
  const summaryEndpoint = `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(randomPage.title)}`;

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
  const response = await fetch('https://pl.wikipedia.org/api/rest_v1/page/random/summary');
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
