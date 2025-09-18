import { useState } from "react";
import { api } from "@/trpc/react";

interface PersonalizedSuggestionsProps {
  query: string;
  onSelectSuggestion?: (suggestion: string) => void;
}

export function PersonalizedSuggestions({ query, onSelectSuggestion }: PersonalizedSuggestionsProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const { data: suggestions, isLoading } = api.chat.getPersonalizedSuggestions.useQuery(
    { query, limit: 5 },
    { enabled: showSuggestions && query.length > 0 }
  );
  
  const { data: stats } = api.chat.getFeedbackStats.useQuery();

  if (query.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-surface-100 bg-surface-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-surface-300 text-surface-300">
          Personalized Suggestions
        </h3>
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="text-xs text-primary-300 hover:text-primary-200 text-primary-300"
        >
          {showSuggestions ? 'Hide' : 'Show'} Suggestions
        </button>
      </div>
      
      {stats && (
        <div className="text-xs text-surface-400 mb-3">
          Based on {stats.likedCount} liked and {stats.dislikedCount} disliked responses
        </div>
      )}

      {showSuggestions && (
        <div>
          {isLoading ? (
            <div className="text-sm text-surface-400">Loading personalized suggestions...</div>
          ) : suggestions && suggestions.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-surface-400 text-surface-400 mb-2">
                Suggestions based on your preferences:
              </div>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-2 bg-surface-100 bg-surface-200 rounded border border-surface-300 border-surface-400 cursor-pointer hover:bg-surface-100 hover:bg-surface-300 transition-colors"
                  onClick={() => onSelectSuggestion?.(suggestion.message.content)}
                >
                  <div className="text-sm text-surface-300 text-surface-200 mb-1">
                    {suggestion.message.content.length > 100 
                      ? `${suggestion.message.content.substring(0, 100)}...`
                      : suggestion.message.content
                    }
                  </div>
                  <div className="flex items-center gap-2 text-xs text-surface-400">
                    <span>Similarity: {(suggestion.score * 100).toFixed(1)}%</span>
                    {suggestion.message.userFeedback && (
                      <span className={`px-1 rounded ${
                        suggestion.message.userFeedback === 'like' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-primary-a20/20 text-primary-a20'
                      }`}>
                        {suggestion.message.userFeedback === 'like' ? '👍 Liked' : '👎 Disliked'}
                      </span>
                    )}
                    <span>({suggestion.message.role})</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-surface-400">
              No personalized suggestions available yet. Start rating messages to get better suggestions!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
