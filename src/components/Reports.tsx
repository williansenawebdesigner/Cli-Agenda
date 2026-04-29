import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { BarChart2, TrendingUp, Users, MessageSquare, Clock, ArrowUpRight, Calendar } from 'lucide-react';

export default function ReportsManager({ userId }: { userId: string }) {
  const [stats, setStats] = useState({
    totalChats: 0,
    totalMessages: 0,
    activeAgents: 1,
    avgResponseTime: '2.4s'
  });

  useEffect(() => {
    const fetchStats = async () => {
      // Simulate real data fetching for MVP
      const qChats = query(collection(db, 'chats'), where('userId', '==', userId));
      const chatSnap = await getDocs(qChats);
      let totalChats = chatSnap.size;
      
      // We would normally count all messages, but for MVP let's estimate
      let totalMessages = totalChats * 14; 
      
      setStats({
        totalChats,
        totalMessages,
        activeAgents: 2,
        avgResponseTime: '1.2s'
      });
    };
    fetchStats();
  }, [userId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 sm:p-10 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-sm text-gray-500 mt-1">Métricas e análise de desempenho</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg">
            <Calendar size={16} className="text-gray-400" />
            Últimos 30 dias
          </div>
        </header>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total de Conversas" 
            value={stats.totalChats.toString()} 
            icon={<MessageSquare size={20} />} 
            trend="+12%" 
            color="emerald" 
          />
          <StatCard 
            title="Clientes Únicos" 
            value={Math.max(1, Math.floor(stats.totalChats * 0.8)).toString()} 
            icon={<Users size={20} />} 
            trend="+5%" 
            color="blue" 
          />
          <StatCard 
            title="Mensagens Processadas" 
            value={stats.totalMessages.toString()} 
            icon={<BarChart2 size={20} />} 
            trend="+24%" 
            color="indigo" 
          />
          <StatCard 
            title="Tempo Resp. (IA)" 
            value={stats.avgResponseTime} 
            icon={<Clock size={20} />} 
            trend="-0.5s" 
            color="amber" 
            trendPositive={true} // Lower is better
          />
        </div>

        {/* Charts Mockup Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">Volume de Mensagens</h3>
              <button className="text-sm text-emerald-600 font-medium hover:underline">Ver detalhes</button>
            </div>
            <div className="h-64 flex items-end gap-2 pb-4 border-b border-gray-100">
              {/* Dummy Bars */}
              {[40, 70, 45, 90, 65, 85, 110].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                  <div 
                    className="w-full bg-emerald-100 hover:bg-emerald-500 rounded-t-sm transition-all" 
                    style={{ height: `${h}%` }}
                  ></div>
                  <div className="absolute -top-8 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {h * 12} msgs
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-xs font-medium text-gray-400">
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-6">Taxa de Resolução</h3>
            <div className="flex flex-col items-center justify-center h-48 relative">
              <svg viewBox="0 0 36 36" className="w-32 h-32 circular-chart">
                <path
                  className="stroke-gray-100"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="stroke-emerald-500"
                  strokeDasharray="85, 100"
                  strokeLinecap="round"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">85%</span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Por IA</span>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-gray-600">Bot IA</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                <span className="text-gray-600">Humano</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color, trendPositive = true }: any) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          <TrendingUp size={12} />
          {trend}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-1">{title}</h4>
        <h2 className="text-2xl font-bold text-gray-900">{value}</h2>
      </div>
    </div>
  );
}
