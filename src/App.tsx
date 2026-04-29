import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase.ts';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Layout, MessageSquare, Shield, Book, LogOut, ChevronRight, Menu, X, Plus, Smartphone, Sparkles, Search, Filter, Box, BarChart2, FileText, SearchCheck, HelpCircle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ChatInterface from './components/Chat.tsx';
import AdminPanel from './components/Admin.tsx';
import KnowledgeBase from './components/Knowledge.tsx';
import WhatsAppManager from './components/WhatsApp.tsx';
import AgentManager from './components/Agents.tsx';
import ClientsManager from './components/Clients.tsx';
import ReportsManager from './components/Reports.tsx';
import { ChatSession } from './types.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'admin' | 'knowledge' | 'whatsapp' | 'agents' | 'clients' | 'reports'>('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        if (u.email === 'contactherogengia@gmail.com') {
          setIsAdmin(true);
        } else {
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
        <div className="p-3 bg-emerald-600 text-white rounded-xl">
          <Calendar size={32} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight"><span style={{fontFamily: '"Dancing Script", cursive'}} className="text-emerald-600">Cli</span> Agenda</h1>
      </div>
      <p className="text-gray-500 mb-8 max-w-md text-center">
        Plataforma unificada para gestão de chats, agendamentos, IA e WhatsApp.
      </p>
      <button
        onClick={handleLogin}
        className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-lg active:scale-95"
      >
        Entrar com Google
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden font-sans">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            className="w-[260px] border-r border-gray-100 flex flex-col bg-white shrink-0 z-20"
          >
            <div className="p-5 flex flex-col gap-4 border-b border-gray-50 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-600 text-white flex items-center justify-center rounded-lg shadow-sm">
                    <Calendar size={18} />
                  </div>
                  <span className="font-bold text-lg text-gray-900"><span style={{fontFamily: '"Dancing Script", cursive'}} className="text-emerald-600">Cli</span> Agenda</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-full border border-yellow-100/50 w-max">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                Visualizando: {user.displayName?.split(' ')[0] || 'Usuário'}
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto w-full py-4 space-y-6">
              {/* Seção Principal */}
              <div className="px-4 space-y-1">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Principal</h3>
                <SidebarItem 
                  icon={<MessageSquare size={18} />} 
                  label="Conversas" 
                  active={activeTab === 'chats'} 
                  onClick={() => setActiveTab('chats')} 
                />
                <SidebarItem 
                  icon={<SearchCheck size={18} />} 
                  label="Clientes" 
                  active={activeTab === 'clients'} 
                  onClick={() => setActiveTab('clients')} 
                />
                <SidebarItem 
                  icon={<BarChart2 size={18} />} 
                  label="Relatórios" 
                  active={activeTab === 'reports'} 
                  onClick={() => setActiveTab('reports')} 
                />
              </div>

              {/* Seção Configuración */}
              <div className="px-4 space-y-1">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Configuração</h3>
                <SidebarItem 
                  icon={<Smartphone size={18} />} 
                  label="WhatsApp" 
                  active={activeTab === 'whatsapp'} 
                  onClick={() => setActiveTab('whatsapp')} 
                />
                <SidebarItem 
                  icon={<Sparkles size={18} />} 
                  label="Agentes IA" 
                  active={activeTab === 'agents'} 
                  onClick={() => setActiveTab('agents')} 
                />
                <SidebarItem 
                  icon={<Book size={18} />} 
                  label="Base de Conhecimento" 
                  active={activeTab === 'knowledge'} 
                  onClick={() => setActiveTab('knowledge')} 
                />
              </div>

              {/* Seção Administración */}
              {isAdmin && (
                <div className="px-4 space-y-1">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Administração</h3>
                  <SidebarItem 
                    icon={<Shield size={18} />} 
                    label="Painel Admin" 
                    active={activeTab === 'admin'} 
                    onClick={() => setActiveTab('admin')} 
                  />
                </div>
              )}
            </nav>

            <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
              <SidebarItem 
                icon={<LogOut size={18} />} 
                label="Sair da visualização" 
                active={false} 
                onClick={handleLogout} 
                className="text-yellow-700 hover:bg-yellow-50 bg-yellow-50/50 border border-yellow-100/50"
              />
              <div className="flex items-center gap-3 px-3 py-2 mt-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user.displayName?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate tracking-tight">{user.displayName || 'Administrador'}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-10 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 text-gray-600"
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
              <div className="flex-1 min-w-0 border-l border-gray-100">
                {selectedChatId ? (
                  <ChatInterface chatId={selectedChatId} user={user} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-[#f4f2ee] text-gray-400">
                    <MessageSquare size={48} className="mb-4 opacity-20" />
                    <p>Selecione uma conversa para iniciar</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'clients' && <ClientsManager userId={user.uid} />}
          {activeTab === 'reports' && <ReportsManager userId={user.uid} />}
          {activeTab === 'admin' && <AdminPanel />}
          {activeTab === 'agents' && <AgentManager userId={user.uid} />}
          {activeTab === 'knowledge' && <KnowledgeBase isAdmin={isAdmin} />}
          {activeTab === 'whatsapp' && <WhatsAppManager userId={user.uid} />}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, className = '' }: { icon: any, label: string, active: boolean, onClick: () => void, className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-all rounded-lg ${
        active 
          ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
      } ${className}`}
    >
      <span className={active ? 'text-emerald-600' : 'text-gray-400'}>{icon}</span>
      {label}
    </button>
  );
}

function ChatList({ selectedId, onSelect, userId }: { selectedId: string | null, onSelect: (id: string) => void, userId: string }) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      // order by updatedAt desc manually if no index
      data.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setChats(data);
    });
    return () => unsubscribe();
  }, [userId]);

  const filteredChats = chats.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()) || c.lastMessage?.toLowerCase().includes(search.toLowerCase()));

  // Generates a color based on the first letter
  const getAvatarColor = (name: string) => {
    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-teal-600', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  };

  return (
    <div className="w-[320px] flex flex-col bg-white hidden sm:flex">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Chats</h2>
          <div className="flex items-center gap-2 text-gray-400">
            <button className="hover:text-gray-600"><Filter size={16} /></button>
            <button className="hover:text-gray-600"><Plus size={16} /></button>
            <div className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{chats.length}</div>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou mensagem..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filteredChats.map(chat => {
          const name = chat.title || 'Desconhecido';
          const initial = name.charAt(0).toUpperCase();
          const time = chat.updatedAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'agora';
          
          return (
            <button
              key={chat.id}
              onClick={() => onSelect(chat.id)}
              className={`w-full text-left p-3 rounded-lg transition-all flex items-start gap-3 group relative mb-0.5 ${
                selectedId === chat.id 
                  ? 'bg-gray-50' 
                  : 'hover:bg-gray-50/50'
              }`}
            >
              <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm ${getAvatarColor(name)}`}>
                {initial}
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`text-[14px] font-semibold truncate text-gray-900`}>
                    {name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] text-gray-500 truncate leading-tight flex-1">
                    <span className="text-gray-400">Você: </span>{chat.lastMessage || '...'}
                  </p>
                </div>
              </div>
              <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                <span className="text-[11px] text-gray-400 font-medium">
                  {time}
                </span>
                <span className="px-1 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase tracking-wider h-max">IA</span>
              </div>
            </button>
          )
        })}
        {chats.length === 0 && (
          <div className="text-center py-12 opacity-30">
            <MessageSquare size={32} className="mx-auto mb-2" />
            <p className="text-xs font-medium">Nenhuma conversa</p>
          </div>
        )}
      </div>
    </div>
  );
}
