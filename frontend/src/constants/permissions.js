export const PERMISSIONS = {
  DASHBOARD_VIEW:       "dashboard.view",
  TRIAGEM_VIEW:         "triagem.view",
  IMPLANTACOES_VIEW:    "implantacoes.view",
  IMPLANTACOES_EDIT:    "implantacoes.edit",
  CLIENTES_VIEW:        "clientes.view",
  CLIENTES_EDIT:        "clientes.edit",
  TEMPLATES_VIEW:       "templates.view",
  TEMPLATES_EDIT:       "templates.edit",
  CONFIGURACOES_VIEW:   "configuracoes.view",
  CONFIGURACOES_EDIT:   "configuracoes.edit",
  USUARIOS_VIEW:        "usuarios.view",
  USUARIOS_CREATE:      "usuarios.create",
  USUARIOS_EDIT:        "usuarios.edit",
  USUARIOS_DELETE:      "usuarios.delete",
  GRUPOS_VIEW:          "grupos.view",
  GRUPOS_CREATE:        "grupos.create",
  GRUPOS_EDIT:          "grupos.edit",
  GRUPOS_DELETE:        "grupos.delete",
};

export const PERMISSION_LABELS = {
  "dashboard.view":      "Visualizar Dashboard",
  "triagem.view":        "Visualizar Triagem",
  "implantacoes.view":   "Visualizar Implantações",
  "implantacoes.edit":   "Editar Implantações",
  "clientes.view":       "Visualizar Clientes",
  "clientes.edit":       "Editar Clientes",
  "templates.view":      "Visualizar Templates",
  "templates.edit":      "Editar Templates",
  "configuracoes.view":  "Visualizar Configurações",
  "configuracoes.edit":  "Editar Configurações",
  "usuarios.view":       "Visualizar Usuários",
  "usuarios.create":     "Criar Usuários",
  "usuarios.edit":       "Editar Usuários",
  "usuarios.delete":     "Excluir Usuários",
  "grupos.view":         "Visualizar Grupos",
  "grupos.create":       "Criar Grupos",
  "grupos.edit":         "Editar Grupos",
  "grupos.delete":       "Excluir Grupos",
};

export const PERMISSION_MODULES = [
  {
    label: "Dashboard",
    permissions: ["dashboard.view"],
  },
  {
    label: "Triagem",
    permissions: ["triagem.view"],
  },
  {
    label: "Implantações",
    permissions: ["implantacoes.view", "implantacoes.edit"],
  },
  {
    label: "Clientes",
    permissions: ["clientes.view", "clientes.edit"],
  },
  {
    label: "Templates",
    permissions: ["templates.view", "templates.edit"],
  },
  {
    label: "Configurações",
    permissions: ["configuracoes.view", "configuracoes.edit"],
  },
  {
    label: "Usuários",
    permissions: ["usuarios.view", "usuarios.create", "usuarios.edit", "usuarios.delete"],
  },
  {
    label: "Grupos de Permissão",
    permissions: ["grupos.view", "grupos.create", "grupos.edit", "grupos.delete"],
  },
];
