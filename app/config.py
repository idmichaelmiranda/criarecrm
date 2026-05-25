import os

# Banco de dados — SQLite local por padrão, PostgreSQL em produção via env
DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./crm.db")

# URL pública do backend — usada para montar caminhos de uploads em produção.
BACKEND_URL: str = os.environ.get("BACKEND_URL", "").rstrip("/")

# URL pública do frontend — usada para configurar CORS em produção.
FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "").rstrip("/")

# Chave secreta JWT
SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-mude-em-producao")

# Supabase Storage — quando configurado, todos os uploads vão para o bucket "uploads"
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY", "")
