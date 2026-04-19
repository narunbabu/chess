import fs from 'fs';

async function search() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/vitogit/chess-puzzles/master/puzzles.json');
    if (res.ok) {
      const data = await res.json();
      console.log('Found puzzles.json, length:', data.length);
    } else {
      console.log('puzzles.json not found', res.status);
    }
  } catch (e) {
    console.error(e);
  }
}

search();
