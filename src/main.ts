import './style.css';
import { boot } from './app.ts';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app');
boot(root);
