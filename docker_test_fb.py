import subprocess, os, sys, tempfile

# Testa embedded mode via isql-fb (ferramenta nativa do Firebird).
# firebird.driver 2.0.x não consegue carregar Engine12 via PluginManager interno
# nesse ambiente Debian, mas isql-fb funciona — confirmado em diagnóstico anterior.
p = tempfile.mktemp(suffix='.fdb')
sql = f"CREATE DATABASE '{p}';\nQUIT;\n"
r = subprocess.run(['isql-fb'], input=sql, capture_output=True, text=True)

success = r.returncode == 0 and os.path.exists(p)

if os.path.exists(p):
    try:
        os.unlink(p)
    except Exception:
        pass

if success:
    print('=== EMBEDDED MODE OK ===')
else:
    print(f'=== EMBEDDED FAILED === rc={r.returncode}')
    print(f'stdout: {r.stdout!r}')
    print(f'stderr: {r.stderr!r}')
    sys.exit(1)
