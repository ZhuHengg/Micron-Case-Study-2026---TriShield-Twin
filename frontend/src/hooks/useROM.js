import { useState, useEffect, useCallback, useRef } from 'react';

export function useROM(params) {
  const [romResult, setRomResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const timeoutRef = useRef(null);

  const fetchROM = useCallback(async (currentParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/rom/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentParams),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setRomResult(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch ROM simulation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchROM(params);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [params, fetchROM]);

  return { romResult, isLoading, error };
}
