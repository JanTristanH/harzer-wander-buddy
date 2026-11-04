"""Exercise the interactive setup with fake CLIs; never access cloud services.

Run: python3 -m unittest discover -s scripts/tests -p test_preview_setup.py -v
"""
import json
import os
from pathlib import Path
import pty
import shutil
import subprocess
import tempfile
import termios
import unittest


SCRIPTS = Path(__file__).resolve().parents[1]
FAKE_CLI = r'''#!/usr/bin/env python3
import base64, json, os, pathlib, sys
tool = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['CALL_LOG'], 'a') as log:
    log.write(json.dumps([tool, *args]) + '\n')
if tool == 'gh':
    if args[:2] == ['auth', 'status']: pass
    elif args[:2] == ['secret', 'list']:
        print(os.environ.get('EXISTING_SECRETS', ''))
    elif args[:2] == ['secret', 'set']:
        assert sys.stdin.read(), 'Empty secret upload'
    elif args[:1] == ['api']:
        if '.permissions.admin // false' in args: print('true')
        elif '.id' in args: print('12345')
        elif any(a.endswith('/environments') for a in args): print(os.environ.get('EXISTING_ENVIRONMENT', 'pr-preview'))
elif tool == 'gcloud':
    if args[:2] == ['auth', 'list']: print('admin@example.test')
    elif args[:3] == ['billing', 'projects', 'describe']:
        print(os.environ.get('BILLING', 'True'))
    elif args[:2] == ['projects', 'describe']:
        print('98765' if '--format=value(projectNumber)' in args else 'hwb-preview-test')
elif tool == 'keytool':
    if '-genkeypair' in args:
        pathlib.Path(args[args.index('-keystore') + 1]).write_text('fake preview key')
    if '-list' in args and os.environ.get('BAD_KEYSTORE'):
        sys.exit(1)
elif tool == 'base64':
    # macOS base64 redirects through /dev/stdout, unavailable in some sandboxes.
    print(base64.b64encode(sys.stdin.buffer.read()).decode())
'''


class PreviewSetupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.repo = self.root / 'repo'
        (self.repo / 'scripts').mkdir(parents=True)
        for name in ('setup-pr-previews.sh', 'setup-gcp-pr-previews.sh'):
            shutil.copyfile(SCRIPTS / name, self.repo / 'scripts' / name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for name in ('gh', 'gcloud', 'keytool', 'base64'):
            path = self.bin / name
            path.write_text(FAKE_CLI)
            path.chmod(0o755)
        self.log = self.root / 'calls.jsonl'
        self.key = self.root / 'preview.jks'
        self.env = {
            **os.environ,
            'PATH': f'{self.bin}{os.pathsep}{os.environ["PATH"]}',
            'CALL_LOG': str(self.log),
            'PROJECT_ID': 'hwb-preview-test',
            'REGION': 'europe-west3',
            'GITHUB_REPOSITORY': 'JanTristanH/harzer-wander-buddy',
            'EXISTING_SECRETS': '',
        }
        self.env.pop('BAD_KEYSTORE', None)

    def run_setup(self, answers='', *, flags=(), overrides=None):
        master, slave = pty.openpty()
        settings = termios.tcgetattr(slave)
        settings[3] &= ~termios.ECHO
        termios.tcsetattr(slave, termios.TCSANOW, settings)
        try:
            proc = subprocess.Popen(
                ['bash', str(self.repo / 'scripts/setup-pr-previews.sh'), *flags],
                stdin=slave, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                env={**self.env, **(overrides or {})},
            )
            os.close(slave)
            slave = None
            if answers:
                os.write(master, answers.encode())
            try:
                output = proc.communicate(timeout=20)[0].decode()
            except subprocess.TimeoutExpired:
                proc.kill()
                output = proc.communicate()[0].decode()
                self.fail(f'Wizard did not finish:\n{output}')
            calls = [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
            return proc.returncode, output, calls
        finally:
            if slave is not None:
                os.close(slave)
            os.close(master)

    @staticmethod
    def to_signing():
        # Repo default, project default, region default, GCP consent, environment check.
        return '\n\n\nj\nj\n'

    def test_check_has_no_remote_calls(self):
        code, _, calls = self.run_setup(flags=['--check'])
        self.assertEqual(code, 0)
        self.assertEqual(calls, [['keytool', '-help']])

    def test_existing_secrets_preserved_and_activation_is_last(self):
        code, output, calls = self.run_setup(
            self.to_signing() + 'n\nj\n',
            overrides={'EXISTING_SECRETS': 'PREVIEW_ANDROID_KEYSTORE_BASE64\nPREVIEW_ANDROID_KEYSTORE_PASSWORD'},
        )
        self.assertEqual(code, 0, output)
        self.assertFalse(any(c[:3] == ['gh', 'secret', 'set'] for c in calls))
        self.assertEqual(calls[-1][:3], ['gh', 'variable', 'set'])
        self.assertEqual(calls[-1][3], 'GCP_PREVIEW_PROJECT_ID')
        self.assertEqual(len([c for c in calls if c[:3] == ['gh', 'variable', 'set']]), 5)
        self.assertFalse(any('workflow' in c for c in calls))

    def test_create_key_and_upload_without_password_arguments(self):
        code, output, calls = self.run_setup(
            self.to_signing() + f'{self.key}\nj\nfixture-password\nfixture-password\nj\nn\nj\n'
        )
        self.assertEqual(code, 0, output)
        self.assertTrue(self.key.is_file())
        self.assertEqual(self.key.stat().st_mode & 0o777, 0o600)
        self.assertEqual(len([c for c in calls if c[:3] == ['gh', 'secret', 'set']]), 2)
        self.assertNotIn('fixture-password', json.dumps(calls) + output)

    def test_incomplete_secrets_do_not_generate_replacement(self):
        code, output, calls = self.run_setup(
            self.to_signing() + f'{self.key}\n',
            overrides={'EXISTING_SECRETS': 'PREVIEW_ANDROID_KEYSTORE_BASE64'},
        )
        self.assertNotEqual(code, 0, output)
        self.assertFalse(self.key.exists())
        self.assertFalse(any('-genkeypair' in c or 'set' in c for c in calls))

    def test_incomplete_secrets_can_be_repaired_with_existing_key(self):
        self.key.write_text('old preview key')
        code, output, calls = self.run_setup(
            self.to_signing() + f'{self.key}\nfixture-password\nj\nn\nj\n',
            overrides={'EXISTING_SECRETS': 'PREVIEW_ANDROID_KEYSTORE_BASE64'},
        )
        self.assertEqual(code, 0, output)
        self.assertEqual(self.key.read_text(), 'old preview key')
        self.assertFalse(any('-genkeypair' in c for c in calls))
        self.assertEqual(len([c for c in calls if c[:3] == ['gh', 'secret', 'set']]), 2)

    def test_missing_environment_is_created_with_consent(self):
        code, output, calls = self.run_setup(
            '\n\n\nj\nj\nj\nn\nj\n',
            overrides={
                'EXISTING_ENVIRONMENT': '',
                'EXISTING_SECRETS': 'PREVIEW_ANDROID_KEYSTORE_BASE64\nPREVIEW_ANDROID_KEYSTORE_PASSWORD',
            },
        )
        self.assertEqual(code, 0, output)
        self.assertEqual(len([c for c in calls if c[:4] == ['gh', 'api', '--method', 'PUT']]), 1)

    def test_bad_existing_key_cannot_upload_or_activate(self):
        self.key.write_text('old preview key')
        code, output, calls = self.run_setup(
            self.to_signing() + f'{self.key}\nfixture-password\n',
            overrides={'BAD_KEYSTORE': '1'},
        )
        self.assertNotEqual(code, 0, output)
        self.assertEqual(self.key.read_text(), 'old preview key')
        self.assertFalse(any('set' in c for c in calls))

    def test_repository_key_path_rejected(self):
        code, output, calls = self.run_setup(self.to_signing() + f'{self.repo}/preview.jks\n')
        self.assertNotEqual(code, 0, output)
        self.assertIn('außerhalb des Repositorys', output)
        self.assertFalse(any('-genkeypair' in c or 'set' in c for c in calls))

    def test_billing_required_before_cloud_mutations(self):
        code, output, calls = self.run_setup('\n\n\n', overrides={'BILLING': 'False'})
        self.assertNotEqual(code, 0, output)
        self.assertIn('Billing ist nicht aktiv', output)
        self.assertFalse(any('enable' in c or 'set' in c for c in calls))

    def test_declining_final_activation_leaves_variables_untouched(self):
        code, output, calls = self.run_setup(
            self.to_signing() + 'n\nn\n',
            overrides={'EXISTING_SECRETS': 'PREVIEW_ANDROID_KEYSTORE_BASE64\nPREVIEW_ANDROID_KEYSTORE_PASSWORD'},
        )
        self.assertNotEqual(code, 0, output)
        self.assertFalse(any(c[:3] == ['gh', 'variable', 'set'] for c in calls))


if __name__ == '__main__':
    unittest.main()
