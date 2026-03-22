import { useEffect, useState } from 'react';
import { discoveryApi } from '@/api/endpoints';
import { DiscoveredUser } from '@/api/types';
import { useDebounce } from '@/hooks/useDebounce';

export const DISCOVERY_SEARCH_MIN_LENGTH = 3;

function looksLikeDiscoveryCode(value: string) {
  return /^[A-Z0-9]{6,8}$/i.test(value);
}

export function useDiscoverySearch(input: string) {
  const [results, setResults] = useState<DiscoveredUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedInput = input.trim();
  const debouncedInput = useDebounce(trimmedInput, 500);
  const isShortQuery = trimmedInput.length > 0 && trimmedInput.length < DISCOVERY_SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (trimmedInput.length >= DISCOVERY_SEARCH_MIN_LENGTH) {
      return;
    }

    setResults([]);
    setIsSearching(false);
    setError(null);
  }, [trimmedInput]);

  useEffect(() => {
    if (!debouncedInput || debouncedInput.length < DISCOVERY_SEARCH_MIN_LENGTH) {
      return;
    }

    let isCancelled = false;

    const searchDiscovery = async () => {
      setIsSearching(true);
      setError(null);

      try {
        if (looksLikeDiscoveryCode(debouncedInput)) {
          const result = await discoveryApi.resolveCode(debouncedInput.toUpperCase());
          if (!isCancelled) {
            setResults([result.data.data]);
          }
          return;
        }

        const result = await discoveryApi.searchUsers(debouncedInput);
        if (!isCancelled) {
          setResults(result.data.data);
        }
      } catch (err: any) {
        if (isCancelled) {
          return;
        }

        if (err.response?.status === 404) {
          setResults([]);
          setError(null);
          return;
        }

        console.error('Search error:', err);
        setError('Failed to search users');
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };

    searchDiscovery();

    return () => {
      isCancelled = true;
    };
  }, [debouncedInput]);

  return {
    results,
    isSearching,
    error,
    isShortQuery,
    minLength: DISCOVERY_SEARCH_MIN_LENGTH,
  };
}
