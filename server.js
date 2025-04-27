import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Funkcja pobierająca ciekawostkę na podstawie tematu od DeepSeek
async function getFactFromAI(topic) {
  const prompt = `
Twoim zadaniem jest stworzenie krótkiej ciekawostki o temacie "${topic}".
- Maksymalnie 500 znaków.
- Styl: przyjazny, lekko naukowy.
- Na końcu podaj źródło w formie URL.
Przykład odpowiedzi:
{
  "title": "Tytuł ciekawostki",
  "fact": "Krótki opis ciekawostki w maks 500 znakach.",
  "source": "https://linkdokategorii.pl"
}
Zwróć odpowiedź w formacie JSON.
`;

const response = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-large', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt
    }),
  });

  if (!response.ok) {
    throw new Error(`Błąd w komunikacji z DeepSeek: ${response.status}`);
  }

  const data = await response.json();

  if (!data || !data[0] || !data[0].generated_text) {
    throw new Error('Brak poprawnej odpowiedzi od DeepSeek');
  }

  // Odpowiedź z modelu powinna być JSON, ale zawsze sprawdzimy
  try {
    return JSON.parse(data[0].generated_text);
  } catch (error) {
    throw new Error('Nie udało się sparsować odpowiedzi jako JSON');
  }
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
    console.error('Błąd podczas pobierania ciekawostki od AI:', error);
    res.status(500).json({ error: 'Nie udało się wygenerować ciekawostki.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
