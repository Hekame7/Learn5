import fetch from 'node-fetch';
import fs from 'fs';

async function getWikipediaSummary() {
  const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
  const data = await response.json();
  return {
    title: data.title,
    summary: data.extract,
    url: data.content_urls.desktop.page,
  };
}

async function saveFact(fact) {
  const facts = fs.existsSync('facts.json') ? JSON.parse(fs.readFileSync('facts.json')) : [];
  facts.push(fact);
  fs.writeFileSync('facts.json', JSON.stringify(facts, null, 2));
}

async function main() {
  try {
    const { title, summary, url } = await getWikipediaSummary();
    console.log(`Pobrano artykuł: ${title}`);
    console.log(`Ciekawostka: ${summary}`);

    await saveFact({
      title,
      fact: summary,
      source: url,
      date: new Date().toISOString(),
    });

    console.log('Ciekawostka zapisana!');
  } catch (error) {
    console.error('Błąd:', error);
  }
}

main();