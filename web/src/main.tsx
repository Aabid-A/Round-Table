import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { StatsPage } from './stats/StatsPage.js';
import { isStatsPage } from './stats/load.js';
import { CardPage } from './card/CardPage.js';
import { isCardPage } from './card/params.js';

const search = window.location.search;
const page = isCardPage(search) ? <CardPage /> : isStatsPage(search) ? <StatsPage /> : <App />;

createRoot(document.getElementById('root') as HTMLElement).render(page);
