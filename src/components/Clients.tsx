import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Search, UserPlus, Filter, MoreHorizontal, Mail, Phone, Calendar, Trash2, Edit2, X, Trello, List } from 'lucide-react';
import { Client } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';

const STAGES = [
  { id: 'lead', title: 'Novos Leads', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'contacted', title: 'Contatados', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'negotiating', title: 'Em Negociação', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'won', title: 'Ganhos', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'lost', title: 'Perdidos', color: 'bg-red-100 text-red-800 border-red-200' }
];

export default function ClientsManager({ userId }: { userId: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', status: 'Ativo' as 'Ativo' | 'Inativo', stage: 'lead' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'clients'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(data);
    });
    return () => unsubscribe();
  }, [userId]);

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search) || 
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getAvatarColor = (name: string) => {
    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-teal-600', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  };

  const openAddModal = () => {
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', status: 'Ativo', stage: 'lead' });
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({ name: client.name || '', phone: client.phone || '', email: client.email || '', status: client.status || 'Ativo', stage: client.stage || 'lead' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    setLoading(true);
    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), {
          ...formData,
        });
      } else {
        await addDoc(collection(db, 'clients'), {
          ...formData,
          userId,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving client:", error);
      alert("Erro ao salvar cliente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente remover o lead ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Erro ao remover cliente.");
    }
  };

  const changeStage = async (id: string, newStage: string) => {
    await updateDoc(doc(db, 'clients', id), { stage: newStage });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] p-6 overflow-hidden">
      <div className="max-w-[1400px] w-full mx-auto flex flex-col h-full">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM de Leads</h1>
            <p className="text-sm text-gray-500 mt-1">Gestão de contatos em formato Kanban</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
               <button onClick={()=>setViewMode('kanban')} className={`p-1.5 rounded flex items-center justify-center ${viewMode === 'kanban' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
                 <Trello size={16} />
               </button>
               <button onClick={()=>setViewMode('list')} className={`p-1.5 rounded flex items-center justify-center ${viewMode === 'list' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
                 <List size={16} />
               </button>
            </div>
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <UserPlus size={16} />
              Novo Lead
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between gap-4 mb-6 shrink-0">
           <div className="relative w-full max-w-sm">
             <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
             <input
               type="text"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Buscar leads..."
               className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm"
             />
           </div>
        </div>

        {viewMode === 'kanban' && (
          <div className="flex-1 overflow-x-auto pb-4">
             <div className="flex gap-4 h-full min-w-max">
               {STAGES.map(stage => {
                  const stageClients = filteredClients.filter(c => (c.stage || 'lead') === stage.id);
                  return (
                    <div key={stage.id} className="w-80 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200/60 overflow-hidden">
                       <div className={`px-4 py-3 border-b text-sm font-bold flex items-center justify-between ${stage.color}`}>
                          <span>{stage.title}</span>
                          <span className="px-2 py-0.5 bg-white/50 rounded shadow-sm text-xs">{stageClients.length}</span>
                       </div>
                       <div className="flex-1 overflow-y-auto p-3 space-y-3">
                          {stageClients.map(client => (
                             <div key={client.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 group relative">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                  <button onClick={()=>openEditModal(client)} className="p-1 text-gray-400 hover:text-emerald-600"><Edit2 size={12}/></button>
                                  <button onClick={()=>handleDelete(client.id, client.name)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12}/></button>
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm pr-10">{client.name || 'Desconhecido'}</h4>
                                <p className="text-[11px] text-gray-500 mt-1 truncate">{client.phone || client.email || 'Sem contato'}</p>
                                
                                {client.customFields && Object.keys(client.customFields).length > 0 && (
                                   <div className="mt-2 flex flex-wrap gap-1">
                                      {Object.entries(client.customFields).slice(0,2).map(([k,v]) => (
                                         <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 truncate max-w-[120px]">{k}: {String(v)}</span>
                                      ))}
                                   </div>
                                )}
                                
                                <div className="mt-4 pt-3 border-t border-gray-50">
                                   <select 
                                     value={client.stage || 'lead'} 
                                     onChange={(e)=>changeStage(client.id, e.target.value)}
                                     className="w-full text-xs bg-gray-50 border border-gray-100 rounded px-2 py-1 outline-none font-medium text-gray-600 focus:border-emerald-300"
                                   >
                                     {STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                   </select>
                                </div>
                             </div>
                          ))}
                          {stageClients.length === 0 && (
                             <div className="text-center py-6 text-xs text-gray-400 font-medium italic">Nenhum lead nesta etapa</div>
                          )}
                       </div>
                    </div>
                  );
               })}
             </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Etapa</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => {
                  const name = client.name || 'Desconhecido';
                  const initial = name.charAt(0).toUpperCase();

                  return (
                    <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColor(name)}`}>
                            {initial}
                          </div>
                          <span className="font-medium text-gray-900">{name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-gray-500">
                          {client.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-gray-400" />
                              <span className="text-xs">{client.phone}</span>
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail size={12} className="text-gray-400" />
                              <span className="text-xs">{client.email}</span>
                            </div>
                          )}
                          {!client.phone && !client.email && <span className="text-[10px] italic">Sem contatos</span>}
                        </div>
                        {client.customFields && Object.keys(client.customFields).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(client.customFields).map(([k, v]) => (
                               <span key={k} className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-50 text-purple-700 tracking-tight border border-purple-100">
                                 {k}: {String(v)}
                               </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <select 
                           value={client.stage || 'lead'} 
                           onChange={(e)=>changeStage(client.id, e.target.value)}
                           className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none font-medium text-gray-700 focus:border-emerald-300"
                        >
                           {STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${
                          client.status === 'Ativo' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>
                          {client.status || 'Ativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(client)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(client.id, name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900">{editingClient ? 'Editar Lead' : 'Novo Lead'}</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="João Silva"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="DDD + Número"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="email@exemplo.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as 'Ativo' | 'Inativo'})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Etapa no Funil</label>
                    <select
                      value={formData.stage}
                      onChange={e => setFormData({...formData, stage: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                    >
                       {STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar Lead'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

