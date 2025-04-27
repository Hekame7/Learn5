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

// Filtrowanie artykułów przez OpenAI
async function filterArticlesByTopic(topic, articles) {
  const prompt = `
Masz temat: "${topic}".

Oto lista artykułów z krótkimi opisami:
${articles.map((a, i) => `${i + 1}. Tytuł: ${a.title} | Opis: ${a.description || 'brak opisu'}`).join('\n')}

Które artykuły naprawdę pasują do tematu "${topic}"?

Podaj numery pasujących artykułów jako listę oddzieloną przecinkami (np. "1, 3, 5"). Jeśli żaden nie pasuje, napisz "brak".
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Twoje zadanie to selekcjonowanie trafnych artykułów do tematu.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0,
    max_tokens: 300,
  });

  const response = completion.choices[0]?.message?.content?.trim();
  if (!response) {
    throw new Error('OpenAI nie zwrócił odpowiedzi.');
  }

  if (response.toLowerCase().includes('brak')) {
    return [];
  }

  const indices = response.split(',').map(n => parseInt(n.trim()) - 1).filter(n => !isNaN(n) && n >= 0 && n < articles.length);
  return indices.map(i => articles[i]);
}

async function generateMultipleTranslations(topic) {
  const prompt = `
Podaj 5 różnych sposobów przetłumaczenia tematu "${topic}" z polskiego na angielski.
Podaj tylko listę słów lub krótkich wyrażeń, oddzielonych przecinkami.
Nie dodawaj wyjaśnień, opisów ani numeracji.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Tłumacz polskie tematy na kilka możliwych wariantów angielskich.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 50,
  });

  const response = completion.choices[0]?.message?.content?.trim();
  if (!response) {
    return [topic]; // fallback
  }

  return response.split(',').map(t => t.trim()).filter(t => t.length > 0);
}



// Endpoint: /fact
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    //  Generowanie wielu tłumaczeń tematu
    const translations = await generateMultipleTranslations(topic);

    let articles = [];
    for (const translatedTopic of translations) {
      try {
        const found = await searchWikipediaOpenSearch(translatedTopic);
        articles = articles.concat(found);
      } catch (error) {
        console.warn(`Brak wyników dla: ${translatedTopic}`);
      }
    }

    //  Usuwamy duplikaty artykułów (po tytule)
    const uniqueArticles = Array.from(new Map(articles.map(a => [a.title, a])).values());

    if (uniqueArticles.length === 0) {
      throw new Error('Nie znaleziono żadnych artykułów dla tematu.');
    }

    //  Filtrowanie artykułów przez OpenAI (po polskim temacie)
    const filteredArticles = await filterArticlesByTopic(topic, uniqueArticles);

    if (filteredArticles.length === 0) {
      throw new Error('Brak trafnych artykułów dla tematu.');
    }

    //  Losujemy trafny artykuł
    const randomArticle = filteredArticles[Math.floor(Math.random() * filteredArticles.length)];

    let lessonSummary = randomArticle.description;

    if (!lessonSummary) {
      const { extract } = await getWikipediaSummary(randomArticle.title);
      lessonSummary = extract || 'Brak dostępnego streszczenia.';
    }

    //  Tłumaczymy streszczenie na polski
    const translatedSummary = await translateToPolish(lessonSummary);

    //  Zwracamy odpowiedź
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
