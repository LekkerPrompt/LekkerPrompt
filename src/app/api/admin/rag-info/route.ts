import { NextResponse } from 'next/server';
import { dataLayer } from '@/server/storage/data-layer';

export async function GET() {
  try {
    // Get user feedback stats
    const stats = await dataLayer.getUserFeedbackStats();
    
    // Get recent liked and disliked messages for display
    const personalizedSuggestions = await dataLayer.getPersonalizedPromptSuggestions('', 'local-user');
    const likedMessages = personalizedSuggestions
      .filter(s => s.message.userFeedback === 'like')
      .map(s => ({
        id: s.message.id,
        content: s.message.content.length > 150 ? s.message.content.substring(0, 150) + '...' : s.message.content,
        role: s.message.role,
        createdAt: s.message.createdAt,
        chatId: s.message.chatId
      }))
      .slice(0, 10); // Show up to 10 recent liked messages

    const dislikedMessages = personalizedSuggestions
      .filter(s => s.message.userFeedback === 'dislike')
      .map(s => ({
        id: s.message.id,
        content: s.message.content.length > 150 ? s.message.content.substring(0, 150) + '...' : s.message.content,
        role: s.message.role,
        createdAt: s.message.createdAt,
        chatId: s.message.chatId
      }))
      .slice(0, 10); // Show up to 10 recent disliked messages

    // Get sample personalized recommendations to show how the system works
    // Only include messages with feedback (like/dislike) since neutral feedback isn't used for learning
    const sampleRecommendations = await dataLayer.getPersonalizedPromptSuggestions('help with coding', 'local-user');
    const customEnvironmentInfo = sampleRecommendations
      .filter(s => s.message.userFeedback === 'like' || s.message.userFeedback === 'dislike') // Only show messages that contribute to learning
      .slice(0, 5)
      .map(s => ({
        content: s.message.content.length > 100 ? s.message.content.substring(0, 100) + '...' : s.message.content,
        score: Math.round(s.score * 100) / 100,
        feedback: s.message.userFeedback,
        role: s.message.role
      }));

    return NextResponse.json({
      stats,
      likedMessages,
      dislikedMessages,
      customEnvironmentInfo,
      ragSystemDescription: {
        howItWorks: "PromptCrafter uses a universal RAG (Retrieval-Augmented Generation) system that applies to ALL models - both local and API-based. The system only learns from your explicit feedback: liked and disliked responses build your custom learning environment, while neutral responses (no rating) are stored but don't influence future recommendations. This ensures your preferences are consistently applied regardless of which model you choose.",
        dataStored: [
          "Message content and embeddings for semantic search",
          "User feedback (like/dislike only - neutral feedback is not used for learning)", 
          "Chat context and metadata",
          "Personalized recommendation scores based only on rated preferences"
        ],
        benefits: [
          "Universal RAG application across all model types (local Ollama, remote APIs)",
          "Better prompt suggestions based only on explicitly liked/disliked responses",
          "Improved response quality tailored to your confirmed preferences",
          "Contextual recommendations that learn from your definitive feedback",
          "All data stored locally for privacy with consistent experience across models"
        ]
      }
    });

  } catch (error) {
    console.error('RAG info retrieval error:', error);
    return NextResponse.json(
      { error: "Failed to retrieve RAG information" },
      { status: 500 }
    );
  }
}
