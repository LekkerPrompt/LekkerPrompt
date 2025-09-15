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

  if (loading) {
    return (
      <div className="p-6 bg-gray-900 text-gray-100 rounded-lg max-w-4xl mx-auto">
        <div className="flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading RAG information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gray-900 text-gray-100 rounded-lg max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-red-400">
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
    <div className="p-6 bg-gray-900 text-gray-100 rounded-lg max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Icon name="db" className="h-5 w-5" />
          RAG System Information
        </h2>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400 flex-1">
            View your personalized learning data and custom environment settings (auto updating)
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-800/50 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              activeTab === tab.id 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-2xl font-semibold text-blue-400">{data.stats.totalMessages}</div>
                <div className="text-xs text-gray-400">Total Messages</div>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-2xl font-semibold text-green-400">{data.stats.likedCount}</div>
                <div className="text-xs text-gray-400">Used for Learning (Liked)</div>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-2xl font-semibold text-red-400">{data.stats.dislikedCount}</div>
                <div className="text-xs text-gray-400">Used for Learning (Disliked)</div>
              </div>
            </div>
            
            {/* Learning Info */}
            <div className="bg-blue-900/20 border border-blue-700/30 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="info" className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-300 mb-1">RAG Learning System</h4>
                  <p className="text-sm text-gray-300">
                    Only liked and disliked responses are used to build your personalized learning environment. 
                    Neutral feedback (no rating) means the message is stored but not used for learning preferences.
                    This applies to all models - local and API-based.
                  </p>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gray-800/30 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-300 mb-2">How It Works</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {data.ragSystemDescription.howItWorks}
              </p>
            </div>

            {/* Data Stored */}
            <div className="bg-gray-800/30 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Data Stored Locally</h3>
              <ul className="space-y-2">
                {data.ragSystemDescription.dataStored.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Benefits */}
            <div className="bg-gray-800/30 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Benefits</h3>
              <ul className="space-y-2">
                {data.ragSystemDescription.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                    <Icon name="star" className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'liked' && (
          <div className="space-y-3">
            {data.likedMessages.length > 0 ? (
              data.likedMessages.map((message) => (
                <div key={message.id} className="bg-gray-800/30 p-4 rounded-lg border-l-2 border-green-500">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400 font-medium">{message.role.toUpperCase()}</span>
                      <Icon name="thumbsUp" className="h-3 w-3 text-green-400" />
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(message.createdAt)}</span>
                  </div>
                  <div className="text-sm text-gray-300 leading-relaxed">{message.content}</div>
                  <div className="text-xs text-gray-500 mt-2">Chat ID: {message.chatId}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Icon name="thumbsUp" className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No liked messages yet</p>
                <p className="text-xs mt-1">Start rating responses to see them here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'disliked' && (
          <div className="space-y-3">
            {data.dislikedMessages.length > 0 ? (
              data.dislikedMessages.map((message) => (
                <div key={message.id} className="bg-gray-800/30 p-4 rounded-lg border-l-2 border-red-500">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400 font-medium">{message.role.toUpperCase()}</span>
                      <Icon name="thumbsDown" className="h-3 w-3 text-red-400" />
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(message.createdAt)}</span>
                  </div>
                  <div className="text-sm text-gray-300 leading-relaxed">{message.content}</div>
                  <div className="text-xs text-gray-500 mt-2">Chat ID: {message.chatId}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Icon name="thumbsDown" className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No disliked messages yet</p>
                <p className="text-xs mt-1">Disliked content helps improve future suggestions</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="space-y-4">
            <div className="bg-gray-800/30 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Custom Environment</h3>
              <p className="text-sm text-gray-400 mb-4">
                Based on your explicit feedback (likes/dislikes only), PromptCrafter has built a custom environment that influences future suggestions across ALL models. 
                Neutral responses are stored but don't contribute to learning. Here's a sample of what the system considers when providing personalized recommendations:
              </p>
            </div>
            
            {data.customEnvironmentInfo.length > 0 ? (
              <div className="space-y-3">
                {data.customEnvironmentInfo.map((info, index) => (
                  <div key={index} className="bg-gray-800/30 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400 font-medium">RECOMMENDATION</span>
                        {info.feedback && (
                          <Icon 
                            name={info.feedback === 'like' ? 'thumbsUp' : 'thumbsDown'} 
                            className={`h-3 w-3 ${info.feedback === 'like' ? 'text-green-400' : 'text-red-400'}`} 
                          />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Relevance: {(info.score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="text-sm text-gray-300 leading-relaxed">{info.content}</div>
                    <div className="text-xs text-gray-500 mt-2">Source: {info.role} message</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Icon name="gear" className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No custom environment built yet</p>
                <p className="text-xs mt-1">Rate more messages to help build your personalized environment</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
