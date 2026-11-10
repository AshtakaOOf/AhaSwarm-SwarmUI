import '$ahakit';
import './lib/customThemes';
import './styles/app.css';
import './styles/browser.css';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });
export default app;
