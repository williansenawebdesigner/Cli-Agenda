import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { doc, onSnapshot, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { MessageSquare, RefreshCw, Power, Smartphone, ExternalLink, QrCode, LogOut, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { WhatsAppInstance } from '../types.ts';

export default function WhatsAppManager({ userId }: { userId: string }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
      const q = query(collection(db, 'agents'), where('userId', '==', userId));
      const snap = await getDocs(q);
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchAgents();
  }, [userId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'whatsapp_instances', userId), (snap) => {
      if (snap.exists()) {
        setInstance({ id: snap.id, ...snap.data() } as WhatsAppInstance);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    let interval: any;
    if (instance) {
      checkStatus();
      interval = setInterval(checkStatus, 5000); // Polling every 5 seconds
    }
    return () => clearInterval(interval);
  }, [instance]);

  const checkStatus = async () => {
    if (!instance) return;
    try {
      const res = await fetch(`/api/whatsapp/connection-state/${instance.instanceName}`, {
        headers: { 'instancekey': instance.apikey }
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
    if (!instance) return;
    try {
      await updateDoc(doc(db, 'whatsapp_instances', userId), { agentId });
    } catch (err) {
      console.error(err);
    }
  };

  const createInstance = async () => {
    setLoading(true);
    try {
      const instanceName = `omni_${userId.slice(0, 5)}`;
      const res = await fetch(`/api/whatsapp/create-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, userId })
      });
      const data = await res.json();
      
      if (data.hash) {
        await setDoc(doc(db, 'whatsapp_instances', userId), {
          userId,
          instanceName,
          apikey: data.hash,
          status: 'close',
          createdAt: serverTimestamp()
        });
      } else {
        console.error("Instance creation failed:", data);
        alert(`Erro ao criar instância: ${data.error || data.response?.message?.[0] || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erro de rede ou servidor ao tentar criar instância.");
    } finally {
      setLoading(false);
    }
  };

  const getQrCode = async () => {
    if (!instance) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/connect/${instance.instanceName}`, {
        headers: { 'instancekey': instance.apikey }
      });
      const data = await res.json();
      if (data.base64) {
        setQrCode(data.base64);
      } else if (data.instance?.state === 'open') {
        alert("WhatsApp já está conectado!");
        checkStatus();
      }
    } catch (err) {
      console.error("Error fetching QR Code:", err);
      alert("Erro ao buscar QR Code. Verifique se a instância está ativa.");
    } finally {
      setLoading(false);
    }
  };

  const logoutInstance = async () => {
    if (!instance || !confirm('Deseja realmente desconectar o WhatsApp?')) return;
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/logout/${instance.instanceName}`, {
        method: 'DELETE',
        headers: { 'instancekey': instance.apikey }
      });
      setQrCode(null);
      checkStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 sm:p-10 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-[5px]">
              <Smartphone size={24} />
            </div>
            <h2 className="text-2xl font-bold">Conexão WhatsApp</h2>
          </div>
          <p className="text-gray-500 text-sm">Integre a OmniChat diretamente com seu WhatsApp via Evolution API.</p>
        </header>

        {!instance ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[5px]">
            <Smartphone size={48} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma Instância Ativa</h3>
            <p className="text-gray-400 mb-6">Crie uma instância para começar a responder automaticamente.</p>
            <button
              onClick={createInstance}
              disabled={loading}
              className="px-8 py-3 bg-emerald-600 text-white rounded-[5px] font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar minha Instância'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-6 border border-gray-100 rounded-[5px] bg-white shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${status?.state === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Power size={20} />
                </div>
                <div>
                  <h3 className="font-bold">{instance.instanceName}</h3>
                  <div className="flex items-center gap-2">
                    <p className={`text-[10px] font-bold uppercase tracking-tighter ${status?.state === 'open' ? 'text-emerald-600' : 'text-gray-400'}`}>
                      Status: {status?.state || 'Desconectado'}
                    </p>
                    {status?.state === 'open' && (
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={checkStatus} className="p-2 hover:bg-gray-50 rounded-[5px] text-gray-400 transition-colors" title="Atualizar Status">
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
                {status?.state === 'open' && (
                  <button 
                    onClick={logoutInstance} 
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-[5px] font-medium transition-colors"
                  >
                    <LogOut size={14} />
                    Desconectar
                  </button>
                )}
              </div>
            </div>

            {status?.state !== 'open' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 border border-gray-100 rounded-[5px] bg-gray-50">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <QrCode size={18} className="text-emerald-600" />
                    Conectar WhatsApp
                  </h4>
                  {qrCode ? (
                    <div className="bg-white p-4 rounded-[5px] shadow-inner mb-4 flex flex-col items-center">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 mb-4" />
                      <p className="text-xs text-gray-500 text-center">Escaneie o código no seu WhatsApp em: <br/><strong>Aparelhos Conectados</strong></p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-4 leading-relaxed italic">
                      Aguardando novo código de pareamento...
                    </p>
                  )}
                  <button 
                    onClick={getQrCode}
                    disabled={loading}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm active:scale-[0.98]"
                  >
                    {loading ? 'Buscando...' : (qrCode ? 'Atualizar QR Code' : 'Exibir QR Code')}
                  </button>
                </div>

                <div className="p-6 border border-gray-100 rounded-[5px] flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-gray-700">
                      <ExternalLink size={18} className="text-blue-500" />
                      Informações da Instância
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest text-emerald-600">Agente Ativo</label>
                        <select 
                          value={instance.agentId || ''}
                          onChange={(e) => updateLinkedAgent(e.target.value)}
                          className="w-full bg-white px-3 py-2 rounded-[5px] text-xs border border-emerald-100 text-gray-600 outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer"
                        >
                          <option value="">Nenhum (Respostas Padrão)</option>
                          {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Instance Name</label>
                        <div className="bg-gray-50 px-3 py-2 rounded-[5px] text-xs font-mono border border-gray-100 text-gray-600">
                          {instance.instanceName}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Instance Key</label>
                        <div className="bg-gray-50 px-3 py-2 rounded-[5px] text-[10px] font-mono break-all border border-gray-100 text-gray-600">
                          {instance.apikey}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-50">
                    <p className="text-[10px] text-gray-400 leading-tight">
                      * O QR Code expira em alguns segundos se não for utilizado. Clique em atualizar caso ele pare de funcionar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status?.state === 'open' && (
              <div className="p-8 border-2 border-emerald-100 bg-emerald-50/30 rounded-[5px] text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone size={32} />
                </div>
                <h3 className="text-lg font-bold text-emerald-900 mb-2">WhatsApp Conectado!</h3>
                <p className="text-emerald-700 text-sm max-w-sm mx-auto">
                  Sua inteligência artificial OmniChat já está ativa e respondendo mensagens automaticamente neste número.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 p-6 bg-emerald-50 rounded-[5px] border border-emerald-100">
          <h4 className="font-bold text-emerald-900 mb-2">Dica do OmniChat</h4>
          <p className="text-sm text-emerald-800 leading-relaxed">
            Uma vez conectado, todas as mensagens enviadas para este WhatsApp serão processadas pela nossa IA usando a sua <strong>Base de Conhecimento</strong> ativa. Certifique-se de manter os documentos atualizados para respostas mais precisas.
          </p>
        </div>
      </div>
    </div>
  );
}
