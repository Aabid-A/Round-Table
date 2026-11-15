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
import './scene/hud.css';
import './slice/slice.css';
import { SlicePage } from './slice/SlicePage.js';
import { isSliceMode } from './slice/params.js';
import { TitleScreen } from './shell/TitleScreen.js';

const search = window.location.search;
// No address at all is the front door; ?mode=replay is the replay's file picker that used to live there.
// The room's own settings (?quality=, ?fallback=1) do not make an address.
const isFrontDoor = [...new URLSearchParams(search).keys()].every((k) => k === 'quality' || k === 'fallback');
const page = isFrontDoor ? (
  <TitleScreen />
) : isCardPage(search) ? (
  <CardPage />
) : isGuessMode(search) ? (
  <GuessPage />
) : isPlayMode(search) ? (
  <PlayPage />
) : isSliceMode(search) ? (
  <SlicePage />
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
