import subprocess, os, sys, tempfile, glob

# isql-fb pode ter nome diferente dependendo de como o buildroot foi montado.
# install.sh normalmente cria o symlink isql-fb; sem ele, o binario pode ser 'isql'.
candidates = [
    '/opt/firebird/bin/isql-fb',
    '/opt/firebird/bin/isql',
    '/usr/bin/isql-fb',
    '/usr/local/bin/isql-fb',
]

isql_cmd = None
for c in candidates:
    if os.path.isfile(c) and os.access(c, os.X_OK):
        isql_cmd = c
        break

if isql_cmd is None:
    print('=== isql-fb NAO ENCONTRADO ===')
    print('Conteudo de /opt/firebird/bin/:')
    for f in sorted(glob.glob('/opt/firebird/bin/*')):
        print(' ', f)
    sys.exit(1)

p = tempfile.mktemp(suffix='.fdb')
sql = f"CREATE DATABASE '{p}';\nQUIT;\n"
r = subprocess.run([isql_cmd], input=sql, capture_output=True, text=True)

success = r.returncode == 0 and os.path.exists(p)
if os.path.exists(p):
    try:
        os.unlink(p)
    except Exception:
        pass

if success:
    print(f'=== EMBEDDED MODE OK (Firebird 2.5) via {isql_cmd} ===')
else:
    print(f'=== EMBEDDED FAILED === rc={r.returncode}')
    print(f'stdout: {r.stdout!r}')
    print(f'stderr: {r.stderr!r}')
    sys.exit(1)
