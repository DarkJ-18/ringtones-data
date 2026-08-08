import subprocess
import os

class ScriptRunner:
    def __init__(self, base_dir: str, venv_python: str):
        self.base_dir = base_dir
        self.venv_python = venv_python

    def run_script(self, script_path: str, env_vars: dict = None, args: list = None) -> tuple:
        """
        Executes a script and returns (stdout_output, stderr_output, return_code)
        """
        env = os.environ.copy()
        if env_vars:
            env.update(env_vars)
            
        cmd = [self.venv_python, script_path]
        if args:
            cmd.extend(args)
            
        try:
            # We use Popen and communicate to capture the output, but in a real async environment we'd stream it.
            # For simplicity in this sync call, we capture it.
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, # Merge stderr into stdout
                text=True,
                env=env,
                cwd=self.base_dir
            )
            stdout, _ = process.communicate()
            return stdout, process.returncode
        except Exception as e:
            return str(e), 1
