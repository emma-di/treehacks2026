import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Hospital } from './pages/Hospital';
import { Patient } from './pages/Patient';
import { Provider } from './pages/Provider';
import { Agent } from './pages/Agent';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'hospital', Component: Hospital },
      { path: 'patient', Component: Patient },
      { path: 'provider', Component: Provider },
      { path: 'agent', Component: Agent },
    ],
  },
]);
