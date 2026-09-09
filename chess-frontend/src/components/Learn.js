import React from 'react';
import { Link } from 'react-router-dom';

const learningPaths = [
  ['Start with the basics', 'Short, guided lessons from the first move to your first checkmate.', '/tutorial', 'Open lessons'],
  ['Solve a daily challenge', 'One small challenge to practise today. Sign in to keep your progress.', '/daily-challenges', 'See today’s challenges'],
  ['Train your tactics', 'Practise spotting checks, captures, and threats at your own pace.', '/tactical-trainer', 'Practise tactics'],
  ['Build a practice habit', 'Structured training exercises for different skill levels.', '/training', 'Explore training'],
];

const Learn = () => <section className="c99-hub">
  <p>LEARN · PRACTISE · PLAY</p>
  <h1>Your next small step in chess</h1>
  <p>New to chess? Start with the basics. Already playing? Try one challenge, then put it into practice.</p>
  <div className="c99-hub-grid">
    {learningPaths.map(([title, description, path, action], index) => <article className="c99-hub-card" key={path}>
      <h2>{title}</h2><p>{description}</p><Link className={index === 0 ? 'c99-primary' : 'c99-secondary'} to={path}>{action}</Link>
    </article>)}
  </div>
  <p className="mt-6">More ways to practise: <Link className="underline" to="/puzzles">Puzzles</Link> · <Link className="underline" to="/ebook">Chess 0–1000 e-book</Link></p>
  <p className="mt-6">Lessons and saved progress may ask you to sign in. You can <Link className="underline" to="/play">try a computer game</Link> without an account.</p>
</section>;

export default Learn;
