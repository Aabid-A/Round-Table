import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { StatsPage } from './stats/StatsPage.js';
import { isStatsPage } from './stats/load.js';

createRoot(document.getElementById('root') as HTMLElement).render(isStatsPage(window.location.search) ? <StatsPage /> : <App />);
