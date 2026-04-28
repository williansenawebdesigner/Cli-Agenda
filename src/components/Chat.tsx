import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Send, Bot, User as UserIcon, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getAnswer } from '../lib/gemini.ts';
import { Message } from '../types.ts';

export default function ChatInterface({ chatId, user }: { chatId: string, user: User }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    try {
      // 1. Save user message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role: 'user',
        content: userMessage,
        createdAt: serverTimestamp()
      });

      // 2. Prepare history for Gemini
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      // 3. Get AI response (RAG)
      const aiResponse = await getAnswer(userMessage, history);

      // 4. Save AI response
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role: 'model',
        content: aiResponse,
        createdAt: serverTimestamp()
      });

      // 5. Update chat metadata
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: aiResponse,
        updatedAt: serverTimestamp(),
        title: messages.length === 0 ? (userMessage.slice(0, 30) + '...') : undefined
      });

    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-4 ${m.role === 'model' ? 'justify-start' : 'justify-end'}`}>
            <div className={`flex gap-3 max-w-[85%] ${m.role === 'model' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className={`w-8 h-8 rounded-[5px] flex items-center justify-center shrink-0 ${
                m.role === 'model' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {m.role === 'model' ? <Bot size={18} /> : <UserIcon size={18} />}
              </div>
              <div>
                <div className={`p-4 rounded-[5px] text-sm leading-relaxed ${
                  m.role === 'model' 
                    ? 'bg-gray-50 text-gray-800' 
                    : 'bg-emerald-600 text-white shadow-sm'
                }`}>
                  {m.content}
                </div>
                <p className={`text-[10px] mt-1 text-gray-400 ${m.role === 'model' ? 'text-left' : 'text-right'}`}>
                  {m.createdAt?.toDate?.().toLocaleTimeString() || 'Enviando...'}
                </p>
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-[5px] bg-emerald-50 flex items-center justify-center">
              <Bot size={18} className="text-emerald-300" />
            </div>
            <div className="p-4 bg-gray-50 rounded-[5px] w-32">
              <div className="flex gap-1 h-full items-center">
                <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-gray-50">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-gray-50 border-none px-4 py-3 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
          />
          <button
            disabled={sending || !input.trim()}
            className="p-3 bg-emerald-600 text-white rounded-[5px] hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:scale-100 active:scale-95 shadow-sm"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
