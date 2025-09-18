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
    onError: (error: unknown) => {
      console.error('Failed to set message feedback:', error);
    }
  });
  const removeMutation = api.chat.removeMessageFeedback.useMutation({
    onSuccess: async () => {
      void utils.chat.getFeedbackStats.invalidate();
      window.dispatchEvent(new CustomEvent('RAG_UPDATE'));
    },
    onError: (error: unknown) => {
      console.error('Failed to remove message feedback:', error);
    }
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
      } catch (error: unknown) {
        // rollback on error
        console.error('Error removing feedback:', error);
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
    } catch (error: unknown) {
      // rollback
      console.error('Error setting feedback:', error);
      setFeedback(prev ?? null);
      onChange?.(prev ?? null);
    } finally {
      setSubmitting(false);
    }
  }, [feedback, messageId, onChange, removeMutation, setMutation, submitting]);

  return (
    <div className={['flex items-center gap-2', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        aria-label={feedback === 'like' ? 'Remove like' : 'Like response'}
        disabled={submitting}
        onClick={() => void handleFeedback('like')}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          border: '1px solid var(--color-outline)',
          background: feedback === 'like' ? '#10b981' : 'var(--color-surface-variant)',
          color: feedback === 'like' ? '#ffffff' : 'var(--color-on-surface-variant)',
          cursor: 'pointer',
          transition: 'all 150ms ease',
          boxShadow: 'var(--shadow-1)',
          opacity: submitting ? 0.5 : 1
        }}
        onMouseEnter={(e) => {
          if (!submitting && feedback !== 'like') {
            e.currentTarget.style.background = '#10b981';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!submitting && feedback !== 'like') {
            e.currentTarget.style.background = 'var(--color-surface-variant)';
            e.currentTarget.style.color = 'var(--color-on-surface-variant)';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'var(--shadow-1)';
          }
        }}
      >
        <Icon name="thumbsUp" className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={feedback === 'dislike' ? 'Remove dislike' : 'Dislike response'}
        disabled={submitting}
        onClick={() => void handleFeedback('dislike')}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          border: '1px solid var(--color-outline)',
          background: feedback === 'dislike' ? '#ef4444' : 'var(--color-surface-variant)',
          color: feedback === 'dislike' ? '#ffffff' : 'var(--color-on-surface-variant)',
          cursor: 'pointer',
          transition: 'all 150ms ease',
          boxShadow: 'var(--shadow-1)',
          opacity: submitting ? 0.5 : 1
        }}
        onMouseEnter={(e) => {
          if (!submitting && feedback !== 'dislike') {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!submitting && feedback !== 'dislike') {
            e.currentTarget.style.background = 'var(--color-surface-variant)';
            e.currentTarget.style.color = 'var(--color-on-surface-variant)';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'var(--shadow-1)';
          }
        }}
      >
        <Icon name="thumbsDown" className="h-4 w-4" />
      </button>
    </div>
  );
}
