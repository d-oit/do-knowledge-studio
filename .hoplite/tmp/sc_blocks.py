import yaml, subprocess, tempfile, os

for f in ['.github/workflows/security-scan.yml', '.github/workflows/sync-turso-skill.yml']:
    d = yaml.safe_load(open(f))
    for jn, j in d['jobs'].items():
        for st in j.get('steps', []):
            r = st.get('run')
            if not r:
                continue
            p = tempfile.NamedTemporaryFile('w', suffix='.sh', delete=False)
            p.write(r)
            p.close()
            out = subprocess.run(['/tmp/shellcheck', '-s', 'bash', '-f', 'gcc', p.name],
                                 capture_output=True, text=True).stdout
            if out:
                print('###', f, jn, st.get('name'))
                print(out)
                for i, line in enumerate(r.splitlines(), 1):
                    print(f'{i:3} {line}')
            os.unlink(p.name)
