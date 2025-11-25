import { GoogleGenAI } from "@google/genai";
import { SaveType } from "../types";

const API_KEY = process.env.API_KEY || '';

let genAI: GoogleGenAI | null = null;

if (API_KEY) {
  genAI = new GoogleGenAI({ apiKey: API_KEY });
}

export const getCommentary = async (
  round: number,
  won: boolean,
  shotType: string,
  saveType?: SaveType
): Promise<string> => {
  console.log('geminiService:getCommentary - Called with:', { round, won, shotType, saveType });
  if (!genAI) {
    console.log('geminiService:getCommentary - No GenAI instance, returning default commentary.');
    return won ? "Great save! Ready for the next round?" : "Goal! Shake it off, goalie.";
  }

  try {
    // Construct a more detailed context string
    let outcomeDetails = "";
    if (won) {
      if (saveType === 'glove') outcomeDetails = "snagged it with a brilliant glove save!";
      else if (saveType === 'butterfly') outcomeDetails = "dropped into a butterfly and denied it!";
      else if (saveType === 'stick') outcomeDetails = "made a sharp stick save!";
      else if (saveType === 'body') outcomeDetails = "blocked it with the body, a human wall!";
      else if (saveType === 'miss') outcomeDetails = `forced the AI to shoot wide!`;
      else outcomeDetails = "SAVED the shot!";
    } else {
      outcomeDetails = "ALLOWED a goal.";
    }
    console.log('geminiService:getCommentary - Outcome details:', outcomeDetails);

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        You are an enthusiastic, high-energy hockey color commentator.
        Context: The player is a goalie in a penalty shot game against an AI.
        Current Round: ${round} / 10.
        Shot Type: ${shotType || 'Standard Shot'}.
        Outcome: The player ${outcomeDetails}.

        Generate a SINGLE, short, punchy sentence (max 15-20 words) reacting to this play.
        - If they made a specific type of save (glove, butterfly), focus on that action.
        - If the shot type was special (Slap Shot, Curveball), mention that.
        - Be encouraging on saves, and constructively critical on goals.
        - Example (Win): "A massive glove save on that blistering slap shot!"
        - Example (Loss): "He got fooled by the curve on that one, just couldn't track it."
      `,
    });

    const commentary = response.text || (won ? "What a save!" : "It's in the net!");
    console.log('geminiService:getCommentary - Generated commentary:', commentary);
    return commentary;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return won ? "Spectacular save!" : "Tough break, goalie!";
  }
};