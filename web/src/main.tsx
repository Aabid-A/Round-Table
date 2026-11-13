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
import { PlayPage } from './play/PlayPage.js';
import { isPlayMode } from './play/params.js';
import { RoomPage } from './rooms/RoomPage.js';
import { isRoomMode, isWatchMode } from './rooms/params.js';
import { WatchPage } from './rooms/WatchPage.js';

const search = window.location.search;
const page = isCardPage(search) ? (
  <CardPage />
) : isGuessMode(search) ? (
  <GuessPage />
) : isPlayMode(search) ? (
  <PlayPage />
) : isWatchMode(search) ? (
  <WatchPage />
) : isRoomMode(search) ? (
  <RoomPage />
) : isEpisodesPage(search) ? (
  <EpisodesPage />
) : isStatsPage(search) ? (
  <StatsPage />
) : (
  <App />
);

createRoot(document.getElementById('root') as HTMLElement).render(page);
