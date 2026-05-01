import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Sparkles, Plus, Trash2, Save, MessageCircle, Settings2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AIAgent } from '../types.ts';

export default function AgentManager({ userId }: { userId: string }) {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setSelectedId] = useState<string | null>(null);

  // New Agent fields
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [useRAG, setUseRAG] = useState(true);
  const [responseDelayMs, setResponseDelayMs] = useState(0);
  const [useTyping, setUseTyping] = useState(true);
  const [callOtherAgents, setCallOtherAgents] = useState(false);
  const [toolsEnabled, setToolsEnabled] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'agents'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAgents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AIAgent)));
    });
    return () => unsubscribe();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !prompt) return;

    if (editingId) {
      await updateDoc(doc(db, 'agents', editingId), {
        name,
        systemPrompt: prompt,
        useRAG,
        responseDelayMs,
        useTyping,
        callOtherAgents,
        tools_enabled: toolsEnabled
      });
      setSelectedId(null);
    } else {
      await addDoc(collection(db, 'agents'), {
        userId,
        name,
        systemPrompt: prompt,
        useRAG,
        responseDelayMs,
        useTyping,
        callOtherAgents,
        tools_enabled: toolsEnabled,
        createdAt: serverTimestamp()
      });
    }

    setName('');
    setPrompt('');
    setUseRAG(true);
    setResponseDelayMs(0);
    setUseTyping(true);
    setCallOtherAgents(false);
    setToolsEnabled([]);
    setIsAdding(false);
  };

  const startEdit = (agent: AIAgent) => {
    setSelectedId(agent.id);
    setName(agent.name);
    setPrompt(agent.systemPrompt);
    setUseRAG(agent.useRAG);
    setResponseDelayMs(agent.responseDelayMs ?? 0);
    setUseTyping(agent.useTyping ?? true);
    setCallOtherAgents(agent.callOtherAgents ?? false);
    setToolsEnabled(agent.tools_enabled || []);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir este agente?')) {
      await deleteDoc(doc(db, 'agents', id));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 sm:p-10 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="text-emerald-500" />
              Seus Agentes
            </h2>
            <p className="text-gray-500 text-sm">Configure o comportamento e as capacidades de cada IA.</p>
          </div>
          <button 
            onClick={() => { setIsAdding(!isAdding); setSelectedId(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Novo Agente
          </button>
        </header>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gray-50 border border-gray-100 rounded-[5px] p-6 mb-8 shadow-sm"
            >
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Nome do Agente</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Consultor de Vendas" 
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col pt-6 gap-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={useRAG} 
                          onChange={(e) => setUseRAG(e.target.checked)} 
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${useRAG ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${useRAG ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">Usar Base de Conhecimento (RAG)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={useTyping} 
                          onChange={(e) => setUseTyping(e.target.checked)} 
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${useTyping ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${useTyping ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">Simular "Digitando..."</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={callOtherAgents} 
                          onChange={(e) => setCallOtherAgents(e.target.checked)} 
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${callOtherAgents ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${callOtherAgents ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">Supervisor de Agentes</span>
                        <span className="text-[10px] text-gray-500">Pode acionar outros agentes como ferramentas para especialidades.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={toolsEnabled.includes('save_client_field')} 
                          onChange={(e) => setToolsEnabled(e.target.checked 
                            ? [...toolsEnabled, 'save_client_field'] 
                            : toolsEnabled.filter(t => t !== 'save_client_field')
                          )} 
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${toolsEnabled.includes('save_client_field') ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolsEnabled.includes('save_client_field') ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">Extração de Dados (CRM)</span>
                        <span className="text-[10px] text-gray-500">Permite extrair dados como nome e email durante a conversa.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={toolsEnabled.includes('get_catalog')} 
                          onChange={(e) => setToolsEnabled(e.target.checked 
                            ? [...toolsEnabled, 'get_catalog'] 
                            : toolsEnabled.filter(t => t !== 'get_catalog')
                          )} 
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${toolsEnabled.includes('get_catalog') ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolsEnabled.includes('get_catalog') ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">Catálogo de Serviços</span>
                        <span className="text-[10px] text-gray-500">Acesso automático a serviços e preços na tela "Catálogos".</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Atraso na Resposta (segundos)</label>
                  <input 
                    type="number" 
                    value={responseDelayMs / 1000}
                    onChange={(e) => setResponseDelayMs(parseFloat(e.target.value) * 1000 || 0)}
                    min="0"
                    step="0.5"
                    placeholder="0" 
                    className="w-full md:w-1/3 px-4 py-2.5 bg-white border border-gray-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Simula o tempo que uma pessoa levaria para ler e responder.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">System Prompt (Instrução)</label>
                  <textarea 
                    rows={5}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Defina como o agente deve se comportar..." 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition-all"
                  />
                  <div className="mt-2 flex items-start gap-2 p-3 bg-emerald-50/50 rounded-[5px] border border-emerald-100">
                    <Sparkles size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-emerald-700 leading-normal">
                      <strong>Dica:</strong> Seja específico. "Responda como um corretor educado que busca marcar visitas" é melhor que "Seja um vendedor".
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Save size={16} />
                    {editingId ? 'Atualizar Agente' : 'Criar Agente'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map(agent => (
            <div key={agent.id} className="group p-6 border border-gray-100 bg-white rounded-[5px] hover:border-emerald-200 hover:shadow-lg transition-all relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-24 h-24 -translate-y-12 translate-x-12 rounded-full blur-3xl opacity-10 transition-colors ${agent.useRAG ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
              
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-[5px]">
                    <MessageCircle size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{agent.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {agent.useRAG ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-tighter">RAG</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[9px] font-bold bg-gray-100 text-gray-500 uppercase tracking-tighter">S/ RAG</span>
                      )}
                      {agent.callOtherAgents && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[9px] font-bold bg-blue-100 text-blue-700 uppercase tracking-tighter">Supervisor</span>
                      )}
                      {agent.useTyping && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[9px] font-bold bg-purple-100 text-purple-700 uppercase tracking-tighter">Typing</span>
                      )}
                      {agent.responseDelayMs ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[9px] font-bold bg-amber-100 text-amber-700 uppercase tracking-tighter">{agent.responseDelayMs / 1000}s Delay</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(agent)} className="p-2 text-gray-400 hover:text-emerald-500 transition-colors">
                    <Settings2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(agent.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed mb-4 min-h-[48px]">
                {agent.systemPrompt}
              </p>

              <div className="pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400">
                <span>Criado em {agent.createdAt?.toDate?.().toLocaleDateString() || 'Recentemente'}</span>
              </div>
            </div>
          ))}
          {agents.length === 0 && !isAdding && (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-gray-100 rounded-[5px]">
              <Sparkles size={40} className="mx-auto mb-4 text-gray-100" />
              <p className="text-gray-400 font-medium font-sans">Nenhum agente configurado ainda.</p>
              <button 
                onClick={() => setIsAdding(true)}
                className="mt-4 text-emerald-600 font-bold hover:underline"
              >
                Crie seu primeiro agente agora
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
