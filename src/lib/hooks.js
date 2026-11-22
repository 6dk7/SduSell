import { useCallback, useEffect, useRef, useState } from 'react';

export function useTitle(title) {
  useEffect(() => { document.title = title; }, [title]);
}

// Load data for a page. Keeps the previous data on screen while a new request
// runs (so filtering does not flash empty) and ignores out-of-date responses.
export function useFetch(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  const reload = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, error: null, loading: true }));
    loader.current().then(
      (data) => { if (id === run.current) setState({ data, error: null, loading: false }); },
      (error) => { if (id === run.current) setState((s) => ({ data: s.data, error, loading: false })); },
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); return () => { run.current++; }; }, deps);
  return { ...state, reload };
}
