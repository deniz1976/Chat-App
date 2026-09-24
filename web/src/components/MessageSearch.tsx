import { useEffect, useState, type KeyboardEvent } from 'react';
import { api } from '../api/client';
import type { Message } from '../api/types';
import { formatListTime } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import { summaryOf } from './MessageItem';

const SEARCH_DELAY_MS = 300;

interface MessageSearchProps {
  chatId: string;
  onSelect(messageId: string): void;
  onClose(): void;
}

const Highlighted = ({ text, term }: { text: string; term: string }) => {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
};

export const MessageSearch = ({ chatId, onSelect, onClose }: MessageSearchProps) => {
  const { state } = useChat();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(true);
  const [found, setFound] = useState<{ term: string; messages: Message[]; failed: boolean }>({
    term: '',
    messages: [],
    failed: false,
  });
  const term = query.trim();
  const results = found.term === term ? found.messages : [];
  const searching = term !== '' && found.term !== term;

  useEffect(() => {
    if (!term) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .searchMessages(chatId, term)
        .then((messages) => ({ term, messages, failed: false }))
        .catch(() => ({ term, messages: [], failed: true }))
        .then((result) => {
          if (!cancelled) {
            setFound(result);
          }
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chatId, term]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="search-bar">
      <label className="dial">
        <b aria-hidden="true">FIND</b>
        <span className="sr-only">Search messages in this chat</span>
        <input
          id="message-search"
          type="search"
          autoFocus
          placeholder="Search this line"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="text-button" onClick={onClose}>
          Close
        </button>
      </label>
      {term && showResults && (
        <ul className="search-results" aria-busy={searching} aria-label="Search results">
          {results.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => {
                  setShowResults(false);
                  onSelect(message.id);
                }}
              >
                <span className="label">
                  {message.senderId === state.me.id
                    ? 'You'
                    : (state.users[message.senderId]?.displayName ?? message.sender?.displayName)}{' '}
                  · {formatListTime(message.createdAt)}
                </span>
                <span className="search-snippet">
                  <Highlighted text={summaryOf(message)} term={term} />
                </span>
              </button>
            </li>
          ))}
          {!searching && results.length === 0 && (
            <li className="label search-empty">
              {found.failed ? 'Search failed. Try again.' : `No messages match “${term}”.`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
