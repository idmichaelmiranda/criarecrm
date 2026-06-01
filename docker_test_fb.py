import subprocess, os, sys, tempfile

# Firebird 2.5 usa libfbembed.so (monolitico) — sem problemas de RTLD ou Engine12.
# isql-fb em embedded mode e a verificacao mais direta e confiavel.
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
    print('=== EMBEDDED MODE OK (Firebird 2.5) ===')
else:
    print(f'=== EMBEDDED FAILED === rc={r.returncode}')
    print(f'stdout: {r.stdout!r}')
    print(f'stderr: {r.stderr!r}')
    sys.exit(1)
