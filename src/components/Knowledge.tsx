import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Book, Plus, Trash2, Search, FileText, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KnowledgeEntry } from '../types.ts';

export default function KnowledgeBase({ isAdmin }: { isAdmin: boolean }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'knowledge'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KnowledgeEntry)));
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;
    await addDoc(collection(db, 'knowledge'), {
      title: newTitle,
      content: newContent,
      tags: [],
      createdAt: serverTimestamp()
    });
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir este item da base de conhecimento?')) {
      await deleteDoc(doc(db, 'knowledge', id));
    }
  };

  const filteredEntries = entries.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 sm:p-10 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl font-bold mb-1">Base de Conhecimento</h2>
            <p className="text-gray-500 text-sm">Gerencie o contexto usado pela IA para responder perguntas.</p>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Adicionar Documento
            </button>
          )}
        </header>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar na base de conhecimento..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
          />
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <form onSubmit={handleAdd} className="p-6 border border-emerald-100 bg-emerald-50/50 rounded-[5px] space-y-4 shadow-inner">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-800 mb-2">Título do Documento</label>
                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Como configurar o roteador" 
                    className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-800 mb-2">Conteúdo / Contexto</label>
                  <textarea 
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Insira aqui o texto informativo que a IA deve aprender..." 
                    className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    Salvar Documento
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-4">
          {filteredEntries.map(entry => (
            <div key={entry.id} className="group p-5 border border-gray-100 bg-white rounded-[5px] hover:border-emerald-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gray-50 text-gray-400 flex items-center justify-center rounded-[5px] group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">{entry.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">
                      {entry.content}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] text-gray-400">
                        Adicionado em {entry.createdAt?.toDate?.().toLocaleDateString() || 'Recentemente'}
                      </span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredEntries.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[5px]">
              <Book size={40} className="mx-auto mb-4 text-gray-200" />
              <p className="text-gray-400 italic">Nenhum documento encontrado na base.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
