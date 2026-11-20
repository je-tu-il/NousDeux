import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useLocalDay() {
  const [day, setDay] = useState(localDateKey);
  useEffect(() => {
    const refresh = () => setDay(localDateKey());
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return day;
}
