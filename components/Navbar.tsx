
import React from 'react';
import { ViewState } from '../types';
import { Icons } from '../constants';

interface NavbarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setView }) => {
  const navItems: { view: ViewState; label: string; icon: React.ReactNode }[] = [
    { view: 'DASHBOARD', label: 'Início', icon: <Icons.Plus /> },
    { view: 'ACTIVE_LIST', label: 'No Pátio', icon: <Icons.Truck /> },
    { view: 'METERS', label: 'Medidores', icon: <Icons.Chart /> },
    { view: 'REPORTS', label: 'Histórico', icon: <Icons.History /> },
    { view: 'SETTINGS', label: 'Ajustes', icon: <Icons.Settings /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center h-20 px-1 max-w-4xl mx-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-colors z-20">
      {navItems.map((item) => (
        <button
          key={item.view}
          onClick={() => setView(item.view)}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            currentView === item.view ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-500 dark:text-slate-500'
          }`}
        >
          <div className={`${currentView === item.view ? 'scale-110' : ''} transition-transform`}>
            {item.icon}
          </div>
          <span className="text-[9px] uppercase mt-1 tracking-wider text-center">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default Navbar;
