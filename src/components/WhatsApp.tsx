import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { doc, onSnapshot, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import { MessageSquare, RefreshCw, Power, Smartphone, ExternalLink, QrCode, LogOut, Sparkles, Plus, Trash2, Settings2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WhatsAppInstance } from '../types.ts';

export default function WhatsAppManager({ userId }: { userId: string }) {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [messageToast, setMessageToast] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessageToast({ text, type });
    setTimeout(() => setMessageToast(null), 4000);
  };

  useEffect(() => {
    const fetchAgents = async () => {
      const q = query(collection(db, 'agents'), where('userId', '==', userId));
      const snap = await getDocs(q);
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchAgents();
  }, [userId]);

  useEffect(() => {
    const q = query(collection(db, 'whatsapp_instances'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInstances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhatsAppInstance)));
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    let interval: any;
    if (selectedInstance) {
      checkStatus();
      interval = setInterval(checkStatus, 5000); 
    } else {
      setStatus(null);
      setQrCode(null);
    }
    return () => clearInterval(interval);
  }, [selectedInstance]);

  const checkStatus = async () => {
    if (!selectedInstance) return;
    try {
      const res = await fetch(`/api/whatsapp/connection-state/${selectedInstance.instanceName}`, {
        headers: { 'instancekey': selectedInstance.apikey }
      });
      const data = await res.json();
      const newState = data.instance?.state || 'close';
      setStatus(data.instance || null);
      
      if (newState === 'open' && qrCode) {
        setQrCode(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateLinkedAgent = async (agentId: string) => {
    if (!selectedInstance) return;
    try {
      await updateDoc(doc(db, 'whatsapp_instances', selectedInstance.id), { agentId });
      setSelectedInstance(prev => prev ? { ...prev, agentId } : null);
    } catch (err) {
      console.error(err);
    }
  };

  const createInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName || typeof newInstanceName !== 'string' || !newInstanceName.trim()) return;
    
    setLoading(true);
    try {
      // Internal unique name based on timestamp/random
      const internalName = `omni_${Math.random().toString(36).substring(2, 7)}_${Date.now().toString().slice(-4)}`;
      
      const res = await fetch(`/api/whatsapp/create-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: internalName, userId })
      });
      const data = await res.json();
      
      if (data.hash) {
        await addDoc(collection(db, 'whatsapp_instances'), {
          userId,
          name: newInstanceName,
          instanceName: internalName,
          apikey: data.hash,
          status: 'close',
          createdAt: serverTimestamp()
        });
        setIsAdding(false);
        setNewInstanceName('');
        showToast('Instância criada com sucesso!');
      } else {
        showToast(`Erro ao criar: ${data.error || 'Erro desconhecido'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao tentar criar instância.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveName = async (id: string) => {
    if (!editNameValue || typeof editNameValue !== 'string' || !editNameValue.trim()) return;
    try {
      await updateDoc(doc(db, 'whatsapp_instances', id), { name: editNameValue });
      if (selectedInstance?.id === id) setSelectedInstance(prev => prev ? { ...prev, name: editNameValue } : null);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      showToast("Erro ao renomear instância.", 'error');
    }
  };

  const deleteInstance = async (id: string, name: string, instanceName: string) => {
    setDeletingId(id);
    setLoading(true);
    console.log(`Starting deletion of instance: ${name} (${instanceName})`);

    try {
      // 1. Delete from Evolution API via proxy
      const res = await fetch(`/api/whatsapp/delete-instance/${instanceName}`, {
        method: 'DELETE'
      });
      
      const responseData = await res.json();
      console.log("Delete proxy response:", responseData);

      if (!res.ok) {
        console.warn('Erro ao remover da Evolution API (ignorando localmente):', responseData);
        // We do NOT throw here so we can still clean up Firebase
        showToast(`Evolution API: ${responseData.error || responseData.details || 'Erro desconhecido'}`, 'error');
      }

      // 2. Delete from Firebase always
      await deleteDoc(doc(db, 'whatsapp_instances', id));
      if (selectedInstance?.id === id) setSelectedInstance(null);
      
      console.log(`Successfully deleted instance: ${id}`);
      showToast(`Instância "${name}" removida com sucesso.`);
    } catch (err) {
      console.error("Delete error:", err);
      showToast(`Erro ao remover a instância: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
      setLoading(false);
    }
  };

  const getQrCode = async () => {
    if (!selectedInstance) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/connect/${selectedInstance.instanceName}`, {
        headers: { 'instancekey': selectedInstance.apikey }
      });
      const data = await res.json();
      if (data.base64) {
        setQrCode(data.base64);
      } else if (data.instance?.state === 'open') {
        showToast("WhatsApp já está conectado!", 'error');
        checkStatus();
      }
    } catch (err) {
      console.error("Error fetching QR Code:", err);
    } finally {
      setLoading(false);
    }
  };

  const logoutInstance = async () => {
    if (!selectedInstance) return;
    setLoading(true);
    setConfirmLogout(false);
    try {
      const res = await fetch(`/api/whatsapp/logout/${selectedInstance.instanceName}`, {
        method: 'DELETE',
        headers: { 'instancekey': selectedInstance.apikey }
      });
      if (res.ok) {
        setQrCode(null);
        checkStatus();
        showToast('WhatsApp desconectado com sucesso.');
      } else {
        const data = await res.json();
        showToast(`Erro: ${data.error || 'Erro no servidor'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Falha na rede ao tentar desconectar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 sm:p-10 overflow-y-auto relative">
      <AnimatePresence>
        {messageToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-50 px-6 py-3 rounded shadow-lg text-sm font-medium ${
              messageToast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
            }`}
          >
            {messageToast.text}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-6xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="text-emerald-500" />
              Instâncias de WhatsApp
            </h2>
            <p className="text-gray-500 text-sm">Gerencie múltiplas conexões e vincule-as a diferentes agentes de IA.</p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nova Instância
          </button>
        </header>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-50 border border-emerald-100 rounded-[5px] p-6 mb-8"
            >
              <form onSubmit={createInstance} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-2">Nome da Instância</label>
                  <input 
                    type="text" 
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    placeholder="Ex: Suporte Comercial" 
                    className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 rounded-[5px] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Criando...' : 'Confirmar Criação'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* List of Instances */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Suas Conexões</h3>
            {instances.map(inst => (
              <div
                key={inst.id}
                onClick={() => setSelectedInstance(inst)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedInstance(inst); }}
                className={`w-full text-left p-4 rounded-[5px] border transition-all flex items-center justify-between group cursor-pointer outline-none ${
                  selectedInstance?.id === inst.id 
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm' 
                    : 'border-gray-100 hover:border-emerald-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-2 h-2 shrink-0 rounded-full ${inst.status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <div className="overflow-hidden">
                    {editingId === inst.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveName(inst.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="bg-white border border-emerald-300 rounded px-2 py-0.5 text-sm outline-none w-full"
                        />
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm font-bold truncate ${selectedInstance?.id === inst.id ? 'text-emerald-900' : 'text-gray-700'}`}>
                          {inst.name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{inst.instanceName}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {editingId === inst.id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); saveName(inst.id); }}
                      className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setEditingId(inst.id); 
                        setEditNameValue(inst.name); 
                      }}
                      className="p-1 text-gray-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Settings2 size={14} />
                    </button>
                  )}
                  {confirmDeleteId === inst.id ? (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="px-2 py-1 text-[10px] uppercase font-bold text-gray-500 hover:bg-gray-100 rounded"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteInstance(inst.id, inst.name, inst.instanceName); }}
                        className="px-2 py-1 text-[10px] uppercase font-bold bg-red-500 text-white hover:bg-red-600 rounded shadow-sm"
                      >
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={deletingId === inst.id}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setConfirmDeleteId(inst.id); 
                      }}
                      className={`p-1 transition-all ${deletingId === inst.id || confirmDeleteId === inst.id ? 'text-gray-400' : 'text-gray-300 hover:text-red-500 hover:bg-red-50 rounded'}`}
                      title="Remover Instância"
                    >
                      {deletingId === inst.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {instances.length === 0 && (
              <div className="text-center py-10 opacity-40 grayscale">
                <Smartphone size={32} className="mx-auto mb-2" />
                <p className="text-xs">Nenhuma instância criada.</p>
              </div>
            )}
          </div>

          {/* Instance Details */}
          <div className="lg:col-span-8">
            {selectedInstance ? (
              <motion.div 
                key={selectedInstance.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white border border-gray-100 rounded-[5px] overflow-hidden shadow-sm"
              >
                <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedInstance.name}</h3>
                    <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{selectedInstance.instanceName}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={checkStatus} className="p-2 hover:bg-white rounded-[5px] text-gray-400 transition-colors shadow-sm" title="Sincronizar Status">
                      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  {/* Connection Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-[5px]">
                        <div className={`p-2 rounded-full ${status?.state === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Power size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Estado Atual</p>
                          <p className={`text-sm font-bold ${status?.state === 'open' ? 'text-emerald-700' : 'text-gray-600'}`}>
                            {status?.state === 'open' ? 'WhatsApp Conectado' : 'Desconectado'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2 ml-1">Vincular Agente de IA</label>
                        <div className="relative">
                          <select 
                            value={selectedInstance.agentId || ''}
                            onChange={(e) => updateLinkedAgent(e.target.value)}
                            className="w-full bg-white px-4 py-2.5 rounded-[5px] text-sm border border-emerald-100 text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                          >
                            <option value="">Nenhum Agente (Manual)</option>
                            {agents.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                          <Settings2 size={16} className="absolute right-3 top-3 text-emerald-400 pointer-events-none" />
                        </div>
                        <p className="mt-2 text-[10px] text-gray-400 italic">O agente selecionado responderá automaticamente a todas as mensagens desta instância.</p>
                      </div>
                    </div>

                    <div className="border border-gray-100 rounded-[5px] p-5 flex flex-col items-center justify-center bg-gray-50/30">
                      {status?.state === 'open' ? (
                        <div className="text-center py-4">
                          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Check size={32} />
                          </div>
                          <h4 className="font-bold text-emerald-900 text-sm">Pronto para Uso</h4>
                          <p className="text-[10px] text-emerald-600 mt-1 mb-4">Instância ativa e monitorada.</p>
                          {confirmLogout ? (
                            <div className="flex flex-col items-center gap-2">
                              <p className="text-xs text-red-500 font-medium">Desconectar?</p>
                              <div className="flex gap-2">
                                <button onClick={() => setConfirmLogout(false)} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">Não</button>
                                <button onClick={logoutInstance} className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 shadow-sm flex items-center gap-1">
                                  <LogOut size={12} />
                                  Sim
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setConfirmLogout(true)}
                              className="text-xs font-semibold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded flex items-center gap-1 mx-auto transition-colors"
                            >
                              <LogOut size={12} />
                              Desconectar WhatsApp
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {qrCode ? (
                            <div className="text-center">
                              <img src={qrCode} alt="QR Code" className="w-40 h-40 mx-auto bg-white p-2 rounded shadow-sm border border-gray-100" />
                              <p className="text-[10px] text-gray-500 mt-3 font-medium">Escaneie com seu WhatsApp</p>
                            </div>
                          ) : (
                            <div className="text-center opacity-40 mb-4">
                              <QrCode size={48} className="mx-auto" />
                              <p className="text-xs mt-2">QR Code não gerado</p>
                            </div>
                          )}
                          <button 
                            onClick={getQrCode}
                            disabled={loading}
                            className="w-full mt-4 py-2.5 bg-emerald-600 text-white rounded-[5px] text-xs font-bold hover:bg-emerald-700 transition-all uppercase tracking-widest active:scale-[0.98]"
                          >
                            {loading ? '...' : (qrCode ? 'Atualizar código' : 'Gerar código QR')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-50">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Segurança e Integração</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded-[5px] border border-gray-100">
                        <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">API Webhook</p>
                        <p className="text-[10px] font-mono text-gray-600 break-all">{window.location.origin}/api/webhooks/whatsapp</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-[5px] border border-gray-100">
                        <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Instance Key (apikey)</p>
                        <p className="text-[10px] font-mono text-gray-600 break-all">{selectedInstance.apikey}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-20 border-2 border-dashed border-gray-50 rounded-[5px] text-gray-300">
                <Smartphone size={64} className="mb-4 opacity-20" />
                <p className="text-lg font-medium opacity-50">Selecione uma instância para gerenciar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

