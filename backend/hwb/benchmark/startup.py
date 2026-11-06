"""Compare deployment-on-start with a pre-migrated start on the same image.

Usage: python3 benchmark/startup.py IMAGE [--runs 5]
Uses disposable SQLite data, never the configured production database.
"""
import argparse
import datetime
import json
import statistics
import subprocess
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('image')
parser.add_argument('--runs', type=int, default=5)
args = parser.parse_args()
if args.runs < 1:
    parser.error('--runs must be positive')


def docker(*argv):
    return subprocess.check_output(['docker', *argv], text=True).strip()


prefix = 'hwb-perf-' + uuid.uuid4().hex[:10]
volume = prefix + '-db'
config = json.dumps({'requires': {'db': {
    'kind': 'sqlite', 'impl': '@sap/cds/libx/_runtime/sqlite/Service.js',
    'credentials': {'url': '/bench/db.sqlite'},
}, 'auth': {'kind': 'mocked'}}})
common = ['--mount', f'type=volume,src={volume},dst=/bench',
          '-e', 'CDS_CONFIG=' + config, '-e', 'CDS_REQUIRES_AUTH_KIND=mocked']
report = {}
docker('volume', 'create', volume)
try:
    docker('run', '--rm', *common, args.image, 'node', 'util/deployProduction.js')
    for deploy_on_start in ['true', 'false']:
        times, memory = [], []
        for index in range(args.runs):
            name = f'{prefix}-{deploy_on_start}-{index}'
            try:
                docker('run', '-d', '--name', name, *common,
                       '-e', 'DEPLOY_ON_START=' + deploy_on_start, args.image)
                deadline = time.monotonic() + 30
                while time.monotonic() < deadline:
                    logs = docker('logs', name)
                    if 'server listening on' in logs:
                        break
                    if docker('inspect', '--format', '{{.State.Running}}', name) != 'true':
                        raise RuntimeError(logs)
                    time.sleep(0.05)
                else:
                    raise RuntimeError('Startup timeout: ' + logs)
                started = docker('inspect', '--format', '{{.State.StartedAt}}', name)
                started = datetime.datetime.fromisoformat(started[:26] + '+00:00')
                timestamp = next(json.loads(line)['timestamp'] for line in logs.splitlines()
                                 if 'server listening on' in line)
                ready = datetime.datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                times.append((ready - started).total_seconds() * 1000)
                memory.append(docker('stats', '--no-stream', '--format', '{{.MemUsage}}', name))
            finally:
                docker('rm', '-f', name)
        report[deploy_on_start] = {
            'medianProcessToListenMs': round(statistics.median(times), 2),
            'runsMs': [round(value, 2) for value in times], 'idleContainerMemory': memory,
        }
finally:
    docker('volume', 'rm', volume)
print(json.dumps(report, indent=2))
