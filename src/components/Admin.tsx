import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Shield, Users, MessageCircle, Database, TrendingUp, ChevronRight, Search } from 'lucide-react';
import { ChatSession } from '../types.ts';

export default function AdminPanel() {
  const [stats, setStats] = useState({
    totalChats: 0,
    totalMessages: 0,
    totalKnowledgeDocs: 0
  });
  const [allChats, setAllChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Basic counts (in a real app we might use cloud functions or aggregation docs)
      const chatsSnap = await getDocs(collection(db, 'chats'));
      const knowledgeSnap = await getDocs(collection(db, 'knowledge'));
      
      setStats({
        totalChats: chatsSnap.size,
        totalMessages: 0, // Hard to count all messages without a real aggregation
        totalKnowledgeDocs: knowledgeSnap.size
      });

      const q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAllChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession)));
        setLoading(false);
      });

      return () => unsubscribe();
    };

    fetchData();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 sm:p-10 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-[5px]">
              <Shield size={24} />
            </div>
            <h2 className="text-2xl font-bold">Admin Console</h2>
          </div>
          <p className="text-gray-500 text-sm">Visão geral do sistema e monitoramento de conversas.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard 
            icon={<MessageCircle size={20} />} 
            label="Total de Conversas" 
            value={stats.totalChats.toString()} 
            color="bg-blue-50 text-blue-600"
          />
          <StatCard 
            icon={<Database size={20} />} 
            label="Documentos RAG" 
            value={stats.totalKnowledgeDocs.toString()} 
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard 
            icon={<TrendingUp size={20} />} 
            label="Status do Sistema" 
            value="Ativo" 
            color="bg-purple-50 text-purple-600"
          />
        </div>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Conversas Recentes</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder="Filtrar chats..." 
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-[5px] text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-[5px] overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-400 font-medium border-b border-gray-100">
                  <th className="px-6 py-4">Usuário / Título</th>
                  <th className="px-6 py-4">Última Mensagem</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allChats.map(chat => (
                  <tr key={chat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{chat.title}</div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{chat.userId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-500 truncate max-w-[250px]">{chat.lastMessage || 'Sem mensagens'}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-[11px]">
                      {chat.updatedAt?.toDate?.().toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-emerald-600 hover:text-emerald-800 font-medium">
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allChats.length === 0 && (
              <div className="p-20 text-center text-gray-300 italic">
                Nenhuma conversa registrada.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="p-6 border border-gray-100 rounded-[5px] flex items-center gap-5 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-[5px] ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
