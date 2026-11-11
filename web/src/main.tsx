import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { StatsPage } from './stats/StatsPage.js';
import { isStatsPage } from './stats/load.js';
import { CardPage } from './card/CardPage.js';
import { isCardPage } from './card/params.js';
import { EpisodesPage } from './guess/EpisodesPage.js';
import { GuessPage } from './guess/GuessPage.js';
import { isEpisodesPage, isGuessMode } from './guess/params.js';

const search = window.location.search;
const page = isCardPage(search) ? (
  <CardPage />
) : isGuessMode(search) ? (
  <GuessPage />
) : isEpisodesPage(search) ? (
  <EpisodesPage />
) : isStatsPage(search) ? (
  <StatsPage />
) : (
  <App />
);

createRoot(document.getElementById('root') as HTMLElement).render(page);
