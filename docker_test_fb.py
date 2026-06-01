import subprocess, os, sys, tempfile

# buildroot.tar.gz instala o binario como 'isql' (sem sufixo -fb).
# install.sh cria o symlink /usr/bin/isql-fb, mas nao rodamos install.sh.
ISQL = '/opt/firebird/bin/isql'

if not os.path.isfile(ISQL):
    print(f'=== FALHOU: {ISQL} nao encontrado ===')
    sys.exit(1)

p = tempfile.mktemp(suffix='.fdb')
sql = f"CREATE DATABASE '{p}';\nQUIT;\n"
r = subprocess.run([ISQL], input=sql, capture_output=True, text=True)

success = r.returncode == 0 and os.path.exists(p)
if os.path.exists(p):
    try:
        os.unlink(p)
    except Exception:
        pass

if success:
    print('=== EMBEDDED MODE OK (Firebird 2.5) ===')
else:
    print(f'=== EMBEDDED FAILED === rc={r.returncode}')
    print(f'stdout: {r.stdout!r}')
    print(f'stderr: {r.stderr!r}')
    sys.exit(1)
