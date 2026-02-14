
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useInternalAuth } from '../context/InternalAuthContext';
import { useAuth } from '../context/AuthContext';
import { InternalUser } from '../types';
import bcrypt from 'bcryptjs';

interface UserManagementProps {
  onBack: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onBack }) => {
  const { internalUser } = useInternalAuth();
  const { session } = useAuth();
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form States
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'porteiro' as 'admin' | 'porteiro'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('internal_users')
      .select('*')
      .eq('supabase_user_id', session.user.id)
      .order('username');
    
    if (!error && data) {
      setUsers(data as InternalUser[]);
    }
    setLoading(false);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    if (!formData.username || (!editMode && !formData.password)) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      let hash = undefined;
      if (formData.password) {
        const salt = await bcrypt.genSalt(10);
        hash = await bcrypt.hash(formData.password, salt);
      }

      if (editMode && selectedUserId) {
        // Update
        const updates: any = { role: formData.role };
        if (hash) updates.password_hash = hash;
        
        const { error } = await supabase
          .from('internal_users')
          .update(updates)
          .eq('id', selectedUserId);

        if (error) throw error;
      } else {
        // Create
        if (!hash) throw new Error("Senha obrigatória para novos usuários.");
        const { error } = await supabase
          .from('internal_users')
          .insert({
            supabase_user_id: session.user.id,
            username: formData.username,
            password_hash: hash,
            role: formData.role,
            must_change_password: true // Força troca de senha no primeiro acesso
          });

        if (error) throw error;
      }

      await fetchUsers();
      closeForm();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (username === 'adm') {
      alert("O usuário ADM principal não pode ser excluído.");
      return;
    }
    if (confirm(`Tem certeza que deseja excluir o usuário ${username}?`)) {
      setLoading(true);
      const { error } = await supabase.from('internal_users').delete().eq('id', id);
      if (error) alert("Erro ao excluir.");
      else await fetchUsers();
      setLoading(false);
    }
  };

  const openEdit = (user: InternalUser) => {
    setEditMode(true);
    setSelectedUserId(user.id);
    setFormData({
      username: user.username,
      password: '', // Senha em branco significa não alterar
      role: user.role
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditMode(false);
    setSelectedUserId(null);
    setFormData({ username: '', password: '', role: 'porteiro' });
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Gestão de Usuários</h2>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md"
        >
          + NOVO USUÁRIO
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-xs text-slate-500 dark:text-slate-400 border dark:border-slate-700">
        Gerencie os usuários que podem acessar o sistema nesta portaria. Apenas Administradores podem criar ou editar contas.
      </div>

      <div className="space-y-3">
        {loading && !showForm && <div className="text-center py-10">Carregando...</div>}
        
        {users.map(user => (
          <div key={user.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${user.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  {user.role === 'admin' ? '🛡️' : '👤'}
                </div>
                <div>
                   <h4 className="font-bold text-slate-800 dark:text-white">{user.username}</h4>
                   <span className="text-[10px] uppercase font-bold text-slate-400">{user.role}</span>
                </div>
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={() => openEdit(user)}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold"
                >
                  EDITAR
                </button>
                {user.username !== 'adm' && (
                  <button 
                    onClick={() => handleDelete(user.id, user.username)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    🗑️
                  </button>
                )}
             </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in duration-300">
              <h3 className="text-lg font-bold dark:text-white">{editMode ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              
              <div className="space-y-3">
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Username</label>
                    <input 
                      disabled={editMode}
                      className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white disabled:opacity-50" 
                      value={formData.username} 
                      onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})} 
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{editMode ? 'Nova Senha (Opcional)' : 'Senha'}</label>
                    <input 
                      type="password"
                      className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white" 
                      placeholder={editMode ? "Deixe em branco para manter" : "Senha inicial"}
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                 </div>
                 
                 {/* Não permitir alterar role do ADM principal */}
                 {(formData.username !== 'adm') && (
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nível de Acesso</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                         <button 
                          type="button"
                          onClick={() => setFormData({...formData, role: 'porteiro'})}
                          className={`p-3 rounded-xl border-2 font-bold text-xs ${formData.role === 'porteiro' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}
                         >
                           PORTEIRO
                         </button>
                         <button 
                          type="button"
                          onClick={() => setFormData({...formData, role: 'admin'})}
                          className={`p-3 rounded-xl border-2 font-bold text-xs ${formData.role === 'admin' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}
                         >
                           ADMIN
                         </button>
                      </div>
                   </div>
                 )}
              </div>

              <div className="flex gap-2 pt-2">
                 <button onClick={closeForm} className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                 <button onClick={handleSaveUser} className="flex-1 p-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase">Salvar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
