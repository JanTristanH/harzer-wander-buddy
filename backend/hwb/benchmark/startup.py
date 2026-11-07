"""Measure production startup against disposable local PostgreSQL data.

Usage: python3 benchmark/startup.py IMAGE [--compare-image BASELINE] [--runs 5]
No production credentials or database are used. Requires postgres:16-alpine.
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
parser.add_argument('--compare-image')
parser.add_argument('--runs', type=int, default=5)
args = parser.parse_args()
if args.runs < 1:
    parser.error('--runs must be positive')


def docker(*argv):
    return subprocess.check_output(['docker', *argv], text=True, timeout=120).strip()


prefix = 'hwb-perf-' + uuid.uuid4().hex[:10]
network, database = prefix + '-net', prefix + '-pg'
password = uuid.uuid4().hex
config = json.dumps({'requires': {'db': {
    'kind': 'postgres', 'impl': '@cap-js/postgres',
    'credentials': {'host': database, 'port': 5432, 'user': 'postgres',
                    'password': password, 'database': 'postgres'},
}, 'auth': {'kind': 'mocked'}}})
common = ['--network', network, '-e', 'CDS_CONFIG=' + config,
          '-e', 'CDS_REQUIRES_AUTH_KIND=mocked']
images = ([args.compare_image] if args.compare_image else []) + [args.image]
report = {}
first_request = '''(async () => {
 const start = performance.now();
 const response = await fetch('http://localhost:4004/odata/v4/public/Stampboxes?$top=1');
 const body = await response.json();
 if (response.status !== 200 || !Array.isArray(body.value)) throw new Error(JSON.stringify(body));
 console.log(JSON.stringify({ ms: performance.now() - start }));
})().catch(error => { console.error(error); process.exitCode = 1; });'''
docker('network', 'create', network)
try:
    docker('run', '-d', '--name', database, '--network', network,
           '--tmpfs', '/var/lib/postgresql/data:rw,size=256m',
           '-e', 'POSTGRES_PASSWORD=' + password, 'postgres:16-alpine')
    for _ in range(120):
        if subprocess.run(['docker', 'exec', database, 'pg_isready', '-U', 'postgres'],
                          capture_output=True).returncode == 0:
            break
        time.sleep(0.25)
    else:
        raise RuntimeError('PostgreSQL did not become ready')
    # The schema exists before either startup mode is measured.
    docker('run', '--rm', *common, images[0], 'node', 'util/deployProduction.js')
    for image_index, image in enumerate(images):
        report[image] = {}
        for deploy_on_start in ['true', 'false']:
            times, first_calls, memory = [], [], []
            name = f'{prefix}-{image_index}-{deploy_on_start}'
            try:
                for index in range(args.runs):
                    if index == 0:
                        docker('run', '-d', '--name', name, *common,
                               '-e', 'DEPLOY_ON_START=' + deploy_on_start, image)
                    else:
                        docker('start', name)
                    started = docker('inspect', '--format', '{{.State.StartedAt}}', name)
                    deadline = time.monotonic() + 30
                    while time.monotonic() < deadline:
                        logs = docker('logs', '--since', started, name)
                        if 'server listening on' in logs:
                            break
                        if docker('inspect', '--format', '{{.State.Running}}', name) != 'true':
                            raise RuntimeError(logs)
                        time.sleep(0.05)
                    else:
                        raise RuntimeError('Startup timeout: ' + logs)
                    started_at = datetime.datetime.fromisoformat(started[:26] + '+00:00')
                    timestamp = next(json.loads(line)['timestamp'] for line in logs.splitlines()
                                     if 'server listening on' in line)
                    ready = datetime.datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    times.append((ready - started_at).total_seconds() * 1000)
                    first_calls.append(json.loads(docker('exec', name, 'node', '-e', first_request))['ms'])
                    memory.append(docker('stats', '--no-stream', '--format', '{{.MemUsage}}', name))
                    docker('stop', '--time', '5', name)
            finally:
                docker('rm', '-f', name)
            report[image][deploy_on_start] = {
                'medianProcessToListenMs': round(statistics.median(times), 2),
                'runsMs': [round(value, 2) for value in times],
                'medianFirstApiMs': round(statistics.median(first_calls), 2),
                'containerMemoryAfterFirstApi': memory,
            }
            print(json.dumps({'progress': image, 'deployOnStart': deploy_on_start,
                              **report[image][deploy_on_start]}), flush=True)
finally:
    docker('rm', '-f', '-v', database)
    docker('network', 'rm', network)
print('STARTUP_BENCHMARK ' + json.dumps(report))
