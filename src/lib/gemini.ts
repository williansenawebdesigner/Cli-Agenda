import { GoogleGenAI } from "@google/genai";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "./firebase.ts";
import { KnowledgeEntry } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getAnswer(prompt: string, history: { role: string, parts: { text: string }[] }[]) {
  // 1. Fetch knowledge for RAG
  const knowledgeRef = collection(db, 'knowledge');
  const q = query(knowledgeRef, limit(10)); // Simple RAG: take first 10 docs
  const querySnapshot = await getDocs(q);
  const context = querySnapshot.docs.map(doc => {
    const data = doc.data() as KnowledgeEntry;
    return `[${data.title}]: ${data.content}`;
  }).join('\n\n');

  const systemInstruction = `
    You are OmniChat AI, a helpful assistant.
    Use the following knowledge base snippets to inform your answers if relevant.
    If the answer is not in the knowledge base, use your general knowledge but mention it.
    
    KNOWLEDGE BASE:
    ${context}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history,
      { role: "user", parts: [{ text: prompt }] }
    ],
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
    },
  });

  return response.text;
}
