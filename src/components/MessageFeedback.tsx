"use client";

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { api } from '@/trpc/react';

interface Props {
  messageId: string;
  initialFeedback?: 'like' | 'dislike' | null;
  className?: string;
  // Notify parent so it can update message list state immediately
  onChange?: (feedback: 'like' | 'dislike' | null) => void;
}

export default function MessageFeedback({ messageId, initialFeedback, className, onChange }: Props) {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(initialFeedback ?? null);
  const [submitting, setSubmitting] = useState(false);
  const utils = api.useUtils();

  // Keep local state in sync if parent changes (e.g., chat reload)
  useEffect(() => {
    setFeedback(initialFeedback ?? null);
  }, [initialFeedback]);

  const setMutation = api.chat.setMessageFeedback.useMutation({
    onSuccess: async () => {
      // Invalidate stats so suggestion components update
      void utils.chat.getFeedbackStats.invalidate();
      window.dispatchEvent(new CustomEvent('RAG_UPDATE'));
    },
  });
  const removeMutation = api.chat.removeMessageFeedback.useMutation({
    onSuccess: async () => {
      void utils.chat.getFeedbackStats.invalidate();
      window.dispatchEvent(new CustomEvent('RAG_UPDATE'));
    },
  });

  const handleFeedback = useCallback(async (newFeedback: 'like' | 'dislike') => {
    if (submitting) return;
    // Toggle off
    if (feedback === newFeedback) {
      setFeedback(null); // optimistic
      onChange?.(null);
      setSubmitting(true);
      try {
        await removeMutation.mutateAsync({ messageId });
      } catch {
        // rollback on error
        setFeedback(newFeedback);
        onChange?.(newFeedback);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Set new feedback
    const prev = feedback;
    setFeedback(newFeedback); // optimistic
    onChange?.(newFeedback);
    setSubmitting(true);
    try {
      await setMutation.mutateAsync({ messageId, feedback: newFeedback });
    } catch {
      // rollback
      setFeedback(prev ?? null);
      onChange?.(prev ?? null);
    } finally {
      setSubmitting(false);
    }
  }, [feedback, messageId, onChange, removeMutation, setMutation, submitting]);

  const baseBtn = 'h-7 w-7 flex items-center justify-center rounded-md border text-xs transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50';
  return (
    <div className={['flex items-center gap-1', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        aria-label={feedback === 'like' ? 'Remove like' : 'Like response'}
        disabled={submitting}
        onClick={() => void handleFeedback('like')}
        className={[
          baseBtn,
          feedback === 'like'
            ? 'bg-green-600/20 border-green-600/40 text-green-400 hover:bg-green-600/30'
            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
        ].join(' ')}
      >
        <Icon name="thumbsUp" className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label={feedback === 'dislike' ? 'Remove dislike' : 'Dislike response'}
        disabled={submitting}
        onClick={() => void handleFeedback('dislike')}
        className={[
          baseBtn,
          feedback === 'dislike'
            ? 'bg-red-600/20 border-red-600/40 text-red-400 hover:bg-red-600/30'
            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
        ].join(' ')}
      >
        <Icon name="thumbsDown" className="h-3 w-3" />
      </button>
    </div>
  );
}
