import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Edit2, X, Check, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Appointment {
  id: string;
  userId: string;
  title: string;
  date: string;
  time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  clientName?: string;
}

export default function CalendarManager({ userId }: { userId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    });
    return () => unsubscribe();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) return;

    if (editingId) {
      await updateDoc(doc(db, 'appointments', editingId), {
        title,
        date,
        time,
        clientName,
        status: 'scheduled'
      });
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'appointments'), {
        userId,
        title,
        date,
        time,
        clientName,
        status: 'scheduled',
        createdAt: serverTimestamp()
      });
    }

    setTitle('');
    setDate('');
    setTime('');
    setClientName('');
    setIsAdding(false);
  };

  const handleEdit = (apt: Appointment) => {
    setTitle(apt.title);
    setDate(apt.date);
    setTime(apt.time);
    setClientName(apt.clientName || '');
    setEditingId(apt.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja cancelar este agendamento?')) {
      await deleteDoc(doc(db, 'appointments', id));
    }
  };

  const markComplete = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'scheduled' : 'completed';
    await updateDoc(doc(db, 'appointments', id), { status: newStatus });
  };

  // Sort appointments
  const sorted = [...appointments].sort((a, b) => {
    return new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime();
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-white p-6 sm:p-10 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="text-emerald-500" />
              Agenda / Calendário
            </h2>
            <p className="text-gray-500 text-sm">Controle seus leads agendados.</p>
          </div>
          <button 
            onClick={() => { setIsAdding(!isAdding); setEditingId(null); setTitle(''); setDate(''); setTime(''); setClientName(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-[5px] text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
             <Plus size={16} />
             Novo Agendamento
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
              <form onSubmit={handleSave} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Título do Agendamento</label>
                     <input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} required className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Nome do Cliente (opcional)</label>
                     <input type="text" value={clientName} onChange={(e)=>setClientName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Data</label>
                     <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} required className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Horário</label>
                     <input type="time" value={time} onChange={(e)=>setTime(e.target.value)} required className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-[5px] text-sm focus:ring-2 focus:ring-emerald-500" />
                   </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancelar</button>
                    <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-[5px] text-sm font-medium shadow-sm"><Save size={16} /> Salvar</button>
                 </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(apt => (
            <div key={apt.id} className={`p-5 rounded-[5px] border hover:shadow-md transition-shadow relative overflow-hidden group ${apt.status === 'completed' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-emerald-100'}`}>
               <div className="flex justify-between items-start mb-2">
                 <h3 className={`font-bold text-lg ${apt.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>{apt.title}</h3>
                 <button onClick={() => markComplete(apt.id, apt.status)} className="text-gray-300 hover:text-emerald-500" title="Marcar concluído">
                   <Check size={20} className={apt.status==='completed' ? 'text-emerald-500' : ''} />
                 </button>
               </div>
               
               {apt.clientName && (
                 <p className="text-sm text-gray-600 mb-3">{apt.clientName}</p>
               )}

               <div className="flex items-center gap-2 text-sm font-medium text-gray-500 bg-gray-50 py-2 px-3 rounded">
                  <CalendarIcon size={16} className="text-emerald-500" />
                  {new Date(apt.date + 'T00:00:00').toLocaleDateString()} 
                  <span className="mx-2 border-l h-4"></span>
                  <Clock size={16} className="text-emerald-500" />
                  {apt.time}
               </div>

               <div className="absolute top-4 right-4 gap-1 opacity-0 group-hover:opacity-100 flex transition-opacity bg-white pl-2">
                 <button onClick={() => handleEdit(apt)} className="p-1 text-gray-400 hover:text-emerald-500"><Edit2 size={16}/></button>
                 <button onClick={() => handleDelete(apt.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
               </div>
            </div>
          ))}
          {sorted.length === 0 && !isAdding && (
             <div className="col-span-full py-20 text-center border-dashed border-2 border-gray-100 rounded-[5px]">
               <CalendarIcon size={40} className="mx-auto text-gray-300 mb-4" />
               <p className="text-gray-400 font-medium">Nenhum agendamento encontrado.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
