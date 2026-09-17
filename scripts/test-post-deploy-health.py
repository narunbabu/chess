"""Offline wiring and exit-code checks; run with python scripts/test-post-deploy-health.py."""
import pathlib
import subprocess
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'chess99-android/scripts/check_backend_health.ps1'


class PostDeployHealthTest(unittest.TestCase):
    def test_workflow_wiring(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/deploy.yml').read_text(encoding='utf-8'))
        steps = workflow['jobs']['deploy']['steps']
        names = [step['name'] for step in steps]
        checkout = steps[names.index('Check out health-check script')]
        health = steps[names.index('Post-deploy health check')]
        self.assertLess(names.index('Check out health-check script'), names.index('Deploy via SSH'))
        self.assertGreater(names.index('Post-deploy health check'), names.index('Deploy via SSH'))
        self.assertEqual(checkout['if'], '${{ !inputs.check_only }}')
        self.assertEqual(health['if'], '${{ success() && !inputs.check_only }}')
        self.assertEqual(health['shell'], 'pwsh')
        self.assertEqual(health['run'].strip(), './chess99-android/scripts/check_backend_health.ps1\nexit $LASTEXITCODE')
        self.assertFalse(health.get('continue-on-error', False))

    def test_probe_exit_codes(self):
        for scenario, expected in [('healthy', 0), ('unhealthy', 1), ('auth-lost', 1), ('unreachable', 1)]:
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory(dir=ROOT / 'scripts') as directory:
                wrapper = pathlib.Path(directory) / 'probe.ps1'
                wrapper.write_text("""
function Invoke-WebRequest {
    param($Uri, [switch]$UseBasicParsing, $TimeoutSec, $Headers)
    if ('SCENARIO' -eq 'unreachable') { throw 'Mock connection refused' }
    $status = 200
    if ($Uri -like '*/synthetic-players' -and 'SCENARIO' -ne 'auth-lost') { $status = 401 }
    $body = '{"status":"healthy"}'
    if ('SCENARIO' -eq 'unhealthy') { $body = '{"status":"unhealthy"}' }
    return [pscustomobject]@{ StatusCode = $status; Content = $body }
}
& 'SCRIPT'
exit $LASTEXITCODE
""".replace('SCENARIO', scenario).replace('SCRIPT', str(SCRIPT).replace("'", "''")), encoding='utf-8')
                result = subprocess.run(['powershell.exe', '-NoProfile', '-File', str(wrapper)], capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
                self.assertIn('PASS ' if expected == 0 else 'FAIL ', result.stdout)


if __name__ == '__main__':
    unittest.main(verbosity=2)
