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

// Szukanie artykułów przez OpenSearch
async function searchWikipediaOpenSearch(topic) {
  const response = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=20&format=json&origin=*`);
  if (!response.ok) {
    throw new Error('Błąd podczas wyszukiwania przez OpenSearch.');
  }
  const data = await response.json();

  const titles = data[1];
  const descriptions = data[2];
  const urls = data[3];

  if (!titles.length) {
    return [];
  }

  return titles.map((title, index) => ({
    title,
    description: descriptions[index],
    url: urls[index],
  }));
}

// Pobieranie streszczenia artykułu z Wikipedii
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

// Tłumaczenie tekstu na polski
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

// Filtrowanie artykułów według trafności tematu
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

// Generowanie tłumaczeń i słów kluczowych
async function generateTranslationsAndKeywords(topic) {
  const prompt = `
Podaj 5 różnych tłumaczeń tematu "${topic}" z polskiego na angielski oraz 3 powiązane słowa kluczowe.
Zwróć wynik wyłącznie w formacie JSON:
{
  "translations": ["tłumaczenie1", "tłumaczenie2", ..., "tłumaczenie5"],
  "keywords": ["słowo1", "słowo2", "słowo3"]
}
Nie dodawaj nic poza JSON.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Zwracaj wyłącznie dane w formacie JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 200,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Brak odpowiedzi z OpenAI podczas generowania tłumaczeń i słów kluczowych.');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error('Nie udało się sparsować odpowiedzi OpenAI.');
  }
}

// Endpoint: /fact
app.get('/fact', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: 'Brak tematu (topic) w zapytaniu.' });
  }

  try {
    const { translations, keywords } = await generateTranslationsAndKeywords(topic);

    const searchTerms = [...translations, ...keywords];

    for (const term of searchTerms) {
      try {
        const articles = await searchWikipediaOpenSearch(term);

        if (articles.length === 0) {
          console.warn(`Brak artykułów dla: ${term}`);
          continue;
        }

        const filteredArticles = await filterArticlesByTopic(topic, articles);

        if (filteredArticles.length > 0) {
          const randomArticle = filteredArticles[Math.floor(Math.random() * filteredArticles.length)];

          let lessonSummary = randomArticle.description;

          if (!lessonSummary) {
            const { extract } = await getWikipediaSummary(randomArticle.title);
            lessonSummary = extract || 'Brak dostępnego streszczenia.';
          }

          const translatedSummary = await translateToPolish(lessonSummary);

          return res.json({
            lessonTitle: `Czego możesz się nauczyć o: ${randomArticle.title}`,
            lessonSummary: translatedSummary,
            source: randomArticle.url,
            date: new Date().toISOString(),
          });
        }

      } catch (error) {
        console.warn(`Błąd podczas przeszukiwania terminu "${term}":`, error.message);
      }
    }

    throw new Error('Nie znaleziono pasujących artykułów dla żadnego tłumaczenia ani słowa kluczowego.');

  } catch (error) {
    console.error('Błąd:', error);
    res.status(500).json({ error: error.message || 'Nie udało się pobrać materiału do nauki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
