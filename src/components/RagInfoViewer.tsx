"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/Icon';

interface RagStats {
  totalMessages: number;
  likedCount: number;
  dislikedCount: number;
  neutralCount: number;
}

interface MessageInfo {
  id: string;
  content: string;
  role: string;
  createdAt: number;
  chatId: string;
}

interface CustomEnvironmentInfo {
  content: string;
  score: number;
  feedback?: 'like' | 'dislike';
  role: string;
}

interface RagSystemDescription {
  howItWorks: string;
  dataStored: string[];
  benefits: string[];
}

interface RagInfoData {
  stats: RagStats;
  likedMessages: MessageInfo[];
  dislikedMessages: MessageInfo[];
  customEnvironmentInfo: CustomEnvironmentInfo[];
  ragSystemDescription: RagSystemDescription;
}

export default function RagInfoViewer() {
  const [data, setData] = useState<RagInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'liked' | 'disliked' | 'custom'>('overview');
  const [resetting, setResetting] = useState(false);

  const fetchRagInfo = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/rag-info');
      if (!response.ok) {
        throw new Error('Failed to fetch RAG information');
      }
      const ragData = await response.json();
      setData(ragData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRagInfo();
  }, [fetchRagInfo]);

  // Live update listeners
  useEffect(() => {
    const handleUpdate = () => fetchRagInfo();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchRagInfo();
    };
    window.addEventListener('RAG_UPDATE', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
    // Light polling fallback (every 30s) only if tab active
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchRagInfo();
    }, 30000);
    return () => {
      window.removeEventListener('RAG_UPDATE', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(id);
    };
  }, [fetchRagInfo]);

  // Reset RAG learning environment
  const resetLearningEnvironment = useCallback(async () => {
    if (!confirm('Reset the entire learning environment? This will remove all likes, dislikes, and custom environment data. This cannot be undone.')) {
      return;
    }
    
    setResetting(true);
    try {
      const response = await fetch('/api/admin/rag-reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-all' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset learning environment');
      }
      
      // Refresh data after reset
      await fetchRagInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset learning environment');
    } finally {
      setResetting(false);
    }
  }, [fetchRagInfo]);

  // Remove specific feedback
  const removeFeedback = useCallback(async (messageId: string, feedbackType: 'like' | 'dislike') => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      
      if (response.ok) {
        // Refresh data after removal
        await fetchRagInfo();
      }
    } catch (err) {
      setError('Failed to remove feedback');
    }
  }, [fetchRagInfo]);

  if (loading) {
    return (
      <div className="p-6 bg-surface-100 text-light rounded-lg max-w-4xl mx-auto">
        <div className="flex items-center justify-center">
          <div className="text-sm text-surface-400">Loading RAG information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-surface-100 text-light rounded-lg max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-primary-a20">
          <span className="text-sm">⚠</span>
          <span className="text-sm">Error loading RAG information: {error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'info' },
    { id: 'liked', label: `Liked (${data.stats.likedCount})`, icon: 'thumbsUp' },
    { id: 'disliked', label: `Disliked (${data.stats.dislikedCount})`, icon: 'thumbsDown' },
    { id: 'custom', label: 'Custom Environment', icon: 'gear' }
  ] as const;

  return (
    <div className="rag-container">
      <div className="rag-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="rag-title">
              <Icon name="db" className="h-5 w-5" />
              RAG System Information
            </h2>
            <p className="rag-subtitle">
              View your personalized learning data and custom environment settings (auto updating)
            </p>
          </div>
          <button
            type="button"
            onClick={resetLearningEnvironment}
            disabled={resetting}
            className="md-btn"
            style={{ 
              padding: '8px 12px',
              opacity: resetting ? 0.6 : 1
            }}
            title="Reset entire learning environment"
          >
            {resetting ? 'Resetting...' : 'Reset All'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="rag-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rag-tab ${activeTab === tab.id ? 'rag-tab--active' : 'rag-tab--inactive'}`}
          >
            <Icon name={tab.icon} className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="rag-stat-grid">
              <div className="rag-stat-card">
                <div className="rag-stat-value">{data.stats.totalMessages}</div>
                <div className="rag-stat-label">Total Messages</div>
              </div>
              <div className="rag-stat-card">
                <div className="rag-stat-value" style={{ color: '#10b981' }}>{data.stats.likedCount}</div>
                <div className="rag-stat-label">Used for Learning (Liked)</div>
              </div>
              <div className="rag-stat-card">
                <div className="rag-stat-value" style={{ color: '#ef4444' }}>{data.stats.dislikedCount}</div>
                <div className="rag-stat-label">Used for Learning (Disliked)</div>
              </div>
            </div>
            
            {/* Learning Info */}
            <div className="rag-info-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Icon name="info" className="h-5 w-5" style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h4 className="rag-section-title">RAG Learning System</h4>
                  <p className="rag-section-text">
                    Only liked and disliked responses are used to build your personalized learning environment. 
                    Neutral feedback (no rating) means the message is stored but not used for learning preferences.
                    This applies to all models - local and API-based.
                  </p>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="rag-section-card">
              <h3 className="rag-section-title">How It Works</h3>
              <p className="rag-section-text">
                {data.ragSystemDescription.howItWorks}
              </p>
            </div>

            {/* Data Stored */}
            <div className="rag-section-card">
              <h3 className="rag-section-title">Data Stored Locally</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.ragSystemDescription.dataStored.map((item, index) => (
                  <li key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span className="rag-section-text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Benefits */}
            <div className="rag-section-card">
              <h3 className="rag-section-title">Benefits</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.ragSystemDescription.benefits.map((benefit, index) => (
                  <li key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="star" className="h-4 w-4" style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
                    <span className="rag-section-text">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'liked' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.likedMessages.length > 0 ? (
              data.likedMessages.map((message) => (
                <div key={message.id} className="rag-message-card rag-message-card--liked">
                  <div className="rag-message-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="rag-message-role rag-message-role--liked">{message.role.toUpperCase()}</span>
                      <Icon name="thumbsUp" className="h-3 w-3" style={{ color: '#10b981' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="rag-message-date">{formatDate(message.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => removeFeedback(message.id, 'like')}
                        className="md-btn"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        title="Remove like"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="rag-message-content">{message.content}</div>
                  <div className="rag-message-meta">Chat ID: {message.chatId}</div>
                </div>
              ))
            ) : (
              <div className="rag-empty">
                <Icon name="thumbsUp" className="rag-empty-icon" />
                <p className="rag-empty-title">No liked messages yet</p>
                <p className="rag-empty-subtitle">Start rating responses to see them here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'disliked' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.dislikedMessages.length > 0 ? (
              data.dislikedMessages.map((message) => (
                <div key={message.id} className="rag-message-card rag-message-card--disliked">
                  <div className="rag-message-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="rag-message-role rag-message-role--disliked">{message.role.toUpperCase()}</span>
                      <Icon name="thumbsDown" className="h-3 w-3" style={{ color: '#ef4444' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="rag-message-date">{formatDate(message.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => removeFeedback(message.id, 'dislike')}
                        className="md-btn"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        title="Remove dislike"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="rag-message-content">{message.content}</div>
                  <div className="rag-message-meta">Chat ID: {message.chatId}</div>
                </div>
              ))
            ) : (
              <div className="rag-empty">
                <Icon name="thumbsDown" className="rag-empty-icon" />
                <p className="rag-empty-title">No disliked messages yet</p>
                <p className="rag-empty-subtitle">Disliked content helps improve future suggestions</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="rag-section-card">
              <h3 className="rag-section-title">Custom Environment</h3>
              <p className="rag-section-text">
                Based on your explicit feedback (likes/dislikes only), PromptCrafter has built a custom environment that influences future suggestions across ALL models. 
                Neutral responses are stored but don't contribute to learning. Here's a sample of what the system considers when providing personalized recommendations:
              </p>
            </div>
            
            {data.customEnvironmentInfo.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.customEnvironmentInfo.map((info, index) => (
                  <div key={index} className="rag-message-card">
                    <div className="rag-message-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="rag-message-role" style={{ color: 'var(--color-primary)' }}>RECOMMENDATION</span>
                        {info.feedback && (
                          <Icon 
                            name={info.feedback === 'like' ? 'thumbsUp' : 'thumbsDown'} 
                            className="h-3 w-3"
                            style={{ color: info.feedback === 'like' ? '#10b981' : '#ef4444' }}
                          />
                        )}
                      </div>
                      <span className="rag-message-date">Relevance: {(info.score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="rag-message-content">{info.content}</div>
                    <div className="rag-message-meta">Source: {info.role} message</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rag-empty">
                <Icon name="gear" className="rag-empty-icon" />
                <p className="rag-empty-title">No custom environment built yet</p>
                <p className="rag-empty-subtitle">Rate more messages to help build your personalized environment</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
