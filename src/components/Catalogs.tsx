import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ShoppingBag, Plus, Trash2, Edit2, Save, X, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Catalog, CatalogItem } from '../types.ts';

interface CatalogsProps {
  userId: string;
}

export default function Catalogs({ userId }: CatalogsProps) {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [items, setItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'catalogs'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCatalogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Catalog)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  const handleSave = async () => {
    if (!name.trim()) return;

    if (editingId) {
      await updateDoc(doc(db, 'catalogs', editingId), {
        name,
        currency,
        items,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'catalogs'), {
        userId,
        name,
        currency,
        items,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    resetForm();
    setIsAdding(false);
  };

  const resetForm = () => {
    setName('');
    setCurrency('BRL');
    setItems([]);
  };

  const handleEdit = (catalog: Catalog) => {
    setName(catalog.name);
    setCurrency(catalog.currency || 'BRL');
    setItems(catalog.items || []);
    setEditingId(catalog.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este catálogo?')) {
      await deleteDoc(doc(db, 'catalogs', id));
    }
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), name: '', price: 0, duration_min: 0, description: '' }]);
  };

  const updateItem = (index: number, field: keyof CatalogItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-600" />
            Catálogos de Serviços/Produtos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Crie listas de preços que os agentes de vendas podem consultar automaticamente.
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Catálogo
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Editar Catálogo' : 'Novo Catálogo'}
              </h2>
              <button onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Catálogo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Serviços Principais v1"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="Ex: BRL"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">Itens / Serviços</label>
                <button
                  onClick={addItem}
                  className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  <Plus className="w-4 h-4" /> Adicionar Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 border border-gray-200 border-dashed rounded-lg text-gray-500 text-sm">
                  Nenhum item adicionado. Adicione um para começar.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="col-span-12 md:col-span-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          placeholder="Nome (ex: Corte)"
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                          placeholder="Preço"
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <input
                          type="number"
                          value={item.duration_min}
                          onChange={(e) => updateItem(index, 'duration_min', parseInt(e.target.value) || 0)}
                          placeholder="Minutos"
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-10 md:col-span-4">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Descrição opcional"
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end">
                        <button onClick={() => removeItem(index)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
              >
                <Save className="w-4 h-4" />
                Salvar Catálogo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {catalogs.map(catalog => (
          <div key={catalog.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-2 bg-white pl-2">
              <button onClick={() => handleEdit(catalog)} className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(catalog.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h3 className="font-bold text-gray-900 pr-16">{catalog.name}</h3>
            <p className="text-sm text-gray-500 mt-1">Moeda: {catalog.currency}</p>
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Itens ({catalog.items?.length || 0})</div>
              {catalog.items?.slice(0, 3).map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700 font-medium truncate pr-2">{item.name}</span>
                  <span className="text-emerald-600 shrink-0 font-mono">
                    {catalog.currency === 'BRL' ? 'R$ ' : ''}{item.price.toFixed(2)}
                  </span>
                </div>
              ))}
              {(catalog.items?.length || 0) > 3 && (
                <div className="text-xs text-gray-500 pt-2 font-medium">
                  + {(catalog.items?.length || 0) - 3} outros itens
                </div>
              )}
            </div>
          </div>
        ))}
        {catalogs.length === 0 && !isAdding && (
           <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
             Nenhum catálogo configurado. Adicione listas de serviços que os agentes podem acessar.
           </div>
        )}
      </div>
    </div>
  );
}
