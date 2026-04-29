import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Send, Bot, User as UserIcon, Loader2, UserPlus, Zap, Paperclip } from 'lucide-react';
import { motion } from 'motion/react';
import { getAnswer } from '../lib/gemini.ts';
import { Message, ChatSession } from '../types.ts';

export default function ChatInterface({ chatId, user }: { chatId: string, user: User }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatData, setChatData] = useState<ChatSession | null>(null);
  const [isAiActive, setIsAiActive] = useState(true);
  const [isIntervening, setIsIntervening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeInstance, setActiveInstance] = useState<any>(null);

  useEffect(() => {
    // Get chat metadata
    const fetchChat = async () => {
      const snap = await getDoc(doc(db, 'chats', chatId));
      if (snap.exists()) {
        setChatData({ id: snap.id, ...snap.data() } as ChatSession);
      }
    };
    fetchChat();

    // Get active whatsapp instance
    const fetchInstance = async () => {
      const { query, collection, where, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'whatsapp_instances'), where('userId', '==', user.uid), where('status', '==', 'open'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setActiveInstance(snap.docs[0].data());
      } else {
        // Fallback
        const allSnap = await getDocs(query(collection(db, 'whatsapp_instances'), where('userId', '==', user.uid)));
        if (!allSnap.empty) {
          setActiveInstance(allSnap.docs[0].data());
        }
      }
    };
    fetchInstance();

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsubscribe();
  }, [chatId, user.uid]);

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
      if (activeInstance && chatData?.whatsappNumber) {
        // Send via Evolution API
        await fetch(`/api/whatsapp/send-message/${activeInstance.instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'instancekey': activeInstance.apikey
          },
          body: JSON.stringify({
            number: chatData.whatsappNumber,
            text: userMessage
          })
        });
      }

      // Save "user" message (which in this context is the agent/model)
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role: 'model', 
        content: userMessage,
        createdAt: serverTimestamp()
      });

      // Update chat metadata
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: userMessage,
        updatedAt: serverTimestamp(),
      });

    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const contactName = chatData?.title || 'Desconhecido';
  const initial = contactName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-[#f4f2ee] relative">
      {/* Header */}
      <div className="h-[68px] flex items-center justify-between px-6 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg relative">
            {initial}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{contactName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-gray-500 font-medium tracking-wide">Passo: <span className="font-bold">início</span></span>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded uppercase tracking-wider">Novo</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-100/50 text-xs font-bold">
            <Zap size={14} className="fill-green-600" />
            0
          </div>
          <button className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
            <UserPlus size={16} />
          </button>
          <button 
            onClick={() => setIsIntervening(!isIntervening)}
            className={`px-4 py-2 border rounded-lg font-semibold text-sm transition-colors shadow-sm ${
              isIntervening ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {isIntervening ? 'Intervindo...' : 'Intervir'}
          </button>
          <button 
            onClick={() => setIsAiActive(!isAiActive)}
            className={`px-4 py-2 font-semibold text-sm rounded-lg border transition-colors shadow-sm ${
              isAiActive ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {isAiActive ? 'Bot IA LIGADO' : 'Bot IA DESLIGADO'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
        <div className="flex justify-center mb-6">
          <span className="px-3 py-1 bg-gray-200/50 text-gray-500 text-xs font-semibold rounded-full shadow-sm">Hoje</span>
        </div>
        
        {messages.map((m) => {
          // If role === 'user', it's the contact (left side, white).
          // If role === 'model', it's the IA / human agent (right side, green).
          const isModel = m.role === 'model';
          return (
            <div key={m.id} className={`flex ${isModel ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${isModel ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
                {isModel && (
                  <div className="flex items-center gap-1 mb-1 text-[11px] text-gray-400 font-semibold px-1">
                    <Bot size={12} className="text-emerald-500" /> IA
                  </div>
                )}
                <div className={`p-3 text-[14px] leading-relaxed relative shadow-sm ${
                  isModel 
                    ? 'bg-[#dcf8c6] text-gray-800 rounded-lg rounded-tr-sm' 
                    : 'bg-white text-gray-800 rounded-lg rounded-tl-sm'
                }`}>
                  {m.content}
                  <div className={`absolute bottom-1.5 ${isModel ? 'right-2' : 'right-2'}`}>
                    
                  </div>
                </div>
                <div className={`text-[10px] mt-1 text-gray-400 font-medium px-1`}>
                  {m.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Enviando...'}
                </div>
              </div>
            </div>
          )
        })}
        {sending && (
          <div className="flex justify-end">
            <div className="p-3 bg-[#dcf8c6] text-gray-800 rounded-lg rounded-tr-sm w-16 shadow-sm opacity-70">
              <div className="flex gap-1 h-full items-center justify-center">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white px-4 py-3 shrink-0 flex flex-col items-center">
        <div className="w-full max-w-4xl flex items-center justify-center gap-2 mb-3 bg-emerald-50/50 text-emerald-600 text-[11px] font-bold rounded-lg py-1.5 border border-emerald-100/50">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Janela aberta (23h 59m)
        </div>
        <form onSubmit={handleSend} className="w-full max-w-4xl flex items-center gap-3">
          <button type="button" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-gray-50 border border-gray-200 px-4 py-3 rounded-full text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none text-gray-700"
          />
          <button
            disabled={sending || !input.trim()}
            className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:scale-100 active:scale-95 shadow-md"
          >
            <Send size={18} className="translate-x-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
