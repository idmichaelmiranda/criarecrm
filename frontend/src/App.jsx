import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/auth/PrivateRoute";
import Landing from "./pages/Landing";
import Solicitar from "./pages/Solicitar";
import Revisao from "./pages/Revisao";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Triagem from "./pages/Triagem";
import Implantacoes from "./pages/Implantacoes";
import ImplantacaoDetalhe from "./pages/ImplantacaoDetalhe";
import Clientes from "./pages/Clientes";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import Templates from "./pages/Templates";
import Resultados from "./pages/Resultados";
import TemplateEditor from "./pages/TemplateEditor";
import Configuracoes from "./pages/Configuracoes";
import Usuarios from "./pages/Usuarios";
import GruposPermissao from "./pages/GruposPermissao";
import BdRestore from "./pages/BdRestore";
import Instalacoes from "./pages/Instalacoes";
import InstalacaoDetalhe from "./pages/InstalacaoDetalhe";
import Registro from "./pages/Registro";
import DefinirSenha from "./pages/DefinirSenha";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/solicitar" element={<Solicitar />} />
          <Route path="/revisao/:token" element={<Revisao />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/definir-senha/:token" element={<DefinirSenha />} />
          <Route path="/login" element={<Login />} />

          {/* Protected admin routes */}
          <Route path="/admin" element={
            <PrivateRoute permission="dashboard.view"><Dashboard /></PrivateRoute>
          } />
          <Route path="/admin/triagem" element={
            <PrivateRoute permission="triagem.view"><Triagem /></PrivateRoute>
          } />
          <Route path="/admin/implantacoes" element={
            <PrivateRoute permission="implantacoes.view"><Implantacoes /></PrivateRoute>
          } />
          <Route path="/admin/implantacoes/:id" element={
            <PrivateRoute permission="implantacoes.view"><ImplantacaoDetalhe /></PrivateRoute>
          } />
          <Route path="/admin/clientes" element={
            <PrivateRoute permission="clientes.view"><Clientes /></PrivateRoute>
          } />
          <Route path="/admin/clientes/:id" element={
            <PrivateRoute permission="clientes.view"><ClienteDetalhe /></PrivateRoute>
          } />
          <Route path="/admin/templates" element={
            <PrivateRoute permission="templates.view"><Templates /></PrivateRoute>
          } />
          <Route path="/admin/resultados" element={
            <PrivateRoute permission="resultados.view"><Resultados /></PrivateRoute>
          } />
          <Route path="/admin/templates/:id" element={
            <PrivateRoute permission="templates.edit"><TemplateEditor /></PrivateRoute>
          } />
          <Route path="/admin/configuracoes" element={
            <PrivateRoute permission="configuracoes.view"><Configuracoes /></PrivateRoute>
          } />
          <Route path="/admin/usuarios" element={
            <PrivateRoute permission="usuarios.view"><Usuarios /></PrivateRoute>
          } />
          <Route path="/admin/grupos-permissao" element={
            <PrivateRoute permission="grupos.view"><GruposPermissao /></PrivateRoute>
          } />
          <Route path="/admin/bd-restore" element={
            <PrivateRoute permission="configuracoes.view"><BdRestore /></PrivateRoute>
          } />
          <Route path="/instalacoes" element={
            <PrivateRoute permission="instalacoes.view"><Instalacoes /></PrivateRoute>
          } />
          <Route path="/instalacoes/:id" element={
            <PrivateRoute permission="instalacoes.view"><InstalacaoDetalhe /></PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
