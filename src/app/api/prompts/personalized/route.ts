import { NextRequest, NextResponse } from "next/server";
import { dataLayer } from "@/server/storage/data-layer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, mode = 'enhance', includePersonalization = true } = body;
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    let enhancedPrompt = query;
    let suggestions: any[] = [];

    if (includePersonalization) {
      // Get personalized suggestions based on user's likes/dislikes
      const personalizedSuggestions = await dataLayer.getPersonalizedPromptSuggestions(query, 'local-user');
      
      if (personalizedSuggestions.length > 0) {
        const topSuggestions = personalizedSuggestions.slice(0, 3);
        const likedContent = topSuggestions
          .filter(s => s.message.userFeedback === 'like')
          .map(s => s.message.content)
          .join('\n\n');
        
        if (likedContent) {
          enhancedPrompt = `Based on your previously liked content, here's an enhanced version of your prompt:\n\nOriginal: ${query}\n\nEnhanced with your preferences: ${likedContent}\n\nCombined prompt: ${query}`;
        }
        
        suggestions = topSuggestions.map(s => ({
          content: s.message.content,
          score: s.score,
          feedback: s.message.userFeedback,
          role: s.message.role,
        }));
      }
    }

    // Get user feedback stats
    const stats = await dataLayer.getUserFeedbackStats();

    return NextResponse.json({
      enhancedPrompt,
      originalQuery: query,
      suggestions,
      personalizationEnabled: includePersonalization,
      userStats: stats,
      mode,
    });

  } catch (error) {
    console.error('Personalized prompt generation error:', error);
    return NextResponse.json(
      { error: "Failed to generate personalized prompt" },
      { status: 500 }
    );
  }
}
