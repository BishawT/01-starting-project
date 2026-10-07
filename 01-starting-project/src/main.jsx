import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// AuthProvider sits OUTSIDE App so every component below it can read the
// session. It also makes exactly one /api/auth/session request on load.
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);