import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const ConfigContext = createContext(null);

// Loads restaurant settings (GST rate, opening hours ...) from the server once.
export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/config')
      .then(setConfig)
      .catch(() => setError('Start the backend first (run "npm run dev" inside the backend folder), then refresh this page.'));
  }, []);

  if (error) {
    return (
      <div className="splash">
        <h2>The server is not reachable</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (!config) return <div className="splash"><p>Loading LUMORA...</p></div>;
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
