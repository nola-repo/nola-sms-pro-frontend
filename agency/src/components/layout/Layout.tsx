import React from 'react';
import { Sidebar } from './Sidebar.tsx';
import { Navbar } from './Navbar.tsx';

export const Layout = ({ children, title, subtitle }) => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar title={title} subtitle={subtitle} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};
