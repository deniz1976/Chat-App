import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';

const SEARCH_DELAY_MS = 250;

export interface UserSearch {
  term: string;
  results: User[];
  searching: boolean;
}

export const useUserSearch = (query: string, excludeIds: string[]): UserSearch => {
  const [found, setFound] = useState<{ term: string; users: User[] }>({ term: '', users: [] });
  const term = query.trim();
  const excludeKey = excludeIds.join(',');

  useEffect(() => {
    if (!term) {
      return;
    }
    let cancelled = false;
    const excluded = new Set(excludeKey.split(','));
    const timer = window.setTimeout(() => {
      api
        .searchUsers(term)
        .then((users) => users.filter((user) => !excluded.has(user.id)))
        .catch(() => [])
        .then((users) => {
          if (!cancelled) {
            setFound({ term, users });
          }
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, excludeKey]);

  return {
    term,
    results: found.term === term ? found.users : [],
    searching: term !== '' && found.term !== term,
  };
};
