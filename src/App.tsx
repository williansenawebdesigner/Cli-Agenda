import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase.ts';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Layout, MessageSquare, Shield, Book, LogOut, ChevronRight, Menu, X, Plus, Smartphone, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ChatInterface from './components/Chat.tsx';
import AdminPanel from './components/Admin.tsx';
import KnowledgeBase from './components/Knowledge.tsx';
import WhatsAppManager from './components/WhatsApp.tsx';
import AgentManager from './components/Agents.tsx';
import { ChatSession } from './types.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'admin' | 'knowledge' | 'whatsapp' | 'agents'>('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Check admin role
        if (u.email === 'contactherogengia@gmail.com') {
          setIsAdmin(true);
        } else {
          // Could also check Firestore admins collection here
          setIsAdmin(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleLogout = () => signOut(auth);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen bg-white text-gray-900 p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-emerald-600 text-white rounded-[5px]">
          <MessageSquare size={32} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">OmniChat <span className="text-emerald-600">AI</span></h1>
      </div>
      <p className="text-gray-500 mb-8 max-w-md text-center">
        Plataforma unificada para gestão de chats, conversas inteligentes com RAG e painel administrativo.
      </p>
      <button
        onClick={handleLogin}
        className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white font-medium rounded-[5px] hover:bg-emerald-700 transition-colors shadow-lg active:scale-95"
      >
        Entrar com Google
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-72 border-r border-gray-100 flex flex-col bg-white shrink-0 z-20"
          >
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-600 text-white flex items-center justify-center rounded-[5px]">
                  <MessageSquare size={18} />
                </div>
                <span className="font-bold text-lg">OmniChat</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-4 py-2 space-y-1">
              <SidebarItem 
                icon={<MessageSquare size={18} />} 
                label="Conversas" 
                active={activeTab === 'chats'} 
                onClick={() => setActiveTab('chats')} 
              />
              <SidebarItem 
                icon={<Sparkles size={18} />} 
                label="Agentes" 
                active={activeTab === 'agents'} 
                onClick={() => setActiveTab('agents')} 
              />
              <SidebarItem 
                icon={<Book size={18} />} 
                label="Base de Conhecimento" 
                active={activeTab === 'knowledge'} 
                onClick={() => setActiveTab('knowledge')} 
              />
              <SidebarItem 
                icon={<Smartphone size={18} />} 
                label="WhatsApp" 
                active={activeTab === 'whatsapp'} 
                onClick={() => setActiveTab('whatsapp')} 
              />
              {isAdmin && (
                <SidebarItem 
                  icon={<Shield size={18} />} 
                  label="Administração" 
                  active={activeTab === 'admin'} 
                  onClick={() => setActiveTab('admin')} 
                />
              )}
            </nav>

            <div className="p-4 border-t border-gray-50">
              <div className="flex items-center gap-3 mb-4 px-2">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-[5px]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut size={16} />
                Sair da conta
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-6 left-6 z-10 p-2 bg-white border border-gray-100 rounded-[5px] shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="flex-1 h-full overflow-hidden">
          {activeTab === 'chats' && (
            <div className="flex h-full">
              <ChatList 
                selectedId={selectedChatId} 
                onSelect={setSelectedChatId} 
                userId={user.uid}
              />
              <div className="flex-1 min-w-0">
                {selectedChatId ? (
                  <ChatInterface chatId={selectedChatId} user={user} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-400">
                    <MessageSquare size={48} className="mb-4 opacity-20" />
                    <p>Selecione uma conversa ou inicie uma nova</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'admin' && <AdminPanel />}
          {activeTab === 'agents' && <AgentManager userId={user.uid} />}
          {activeTab === 'knowledge' && <KnowledgeBase isAdmin={isAdmin} />}
          {activeTab === 'whatsapp' && <WhatsAppManager userId={user.uid} />}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-[5px] ${
        active 
          ? 'bg-emerald-50 text-emerald-700' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ChatList({ selectedId, onSelect, userId }: { selectedId: string | null, onSelect: (id: string) => void, userId: string }) {
  const [chats, setChats] = useState<ChatSession[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      setChats(data);
    });
    return () => unsubscribe();
  }, [userId]);

  return (
    <div className="w-80 border-r border-gray-100 flex flex-col bg-white hidden sm:flex">
      <div className="p-6 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">Conversas</h2>
          <div className="p-1 px-2 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-[5px] uppercase tracking-tighter">WhatsApp</div>
        </div>
        <p className="text-xs text-gray-400">Mensagens recebidas via API.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chats.map(chat => (
          <button
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={`w-full text-left p-4 rounded-[5px] transition-all relative ${
              selectedId === chat.id 
                ? 'bg-emerald-50 border border-emerald-100 shadow-sm' 
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={`text-sm font-bold truncate ${selectedId === chat.id ? 'text-emerald-900' : 'text-gray-700'}`}>
                {chat.title}
              </span>
              <span className="text-[9px] text-gray-400 font-mono">
                {chat.updatedAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
              </span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-1 italic">
              {chat.lastMessage || 'Aguardando interação...'}
            </p>
          </button>
        ))}
        {chats.length === 0 && (
          <div className="text-center py-12 opacity-30">
            <MessageSquare size={32} className="mx-auto mb-2" />
            <p className="text-xs font-medium">Nenhuma conversa encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
