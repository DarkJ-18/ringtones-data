import os
import re
import requests
import subprocess
import sys

def print_out(msg):
    print(msg)
    sys.stdout.flush()

def get_repo_info(base_dir):
    """Detecta dinámicamente el usuario/repositorio y la rama desde la configuración de Git"""
    repo_slug = "DeliaDevS2/ringtones-data"
    branch = "main"
    try:
        url = subprocess.check_output(["git", "config", "--get", "remote.origin.url"], cwd=base_dir, text=True).strip()
        m = re.search(r"github\.com[:/]([^/]+)/([^/\.]+)", url)
        if m:
            repo_slug = f"{m.group(1)}/{m.group(2)}"
    except Exception:
        pass

    try:
        b = subprocess.check_output(["git", "branch", "--show-current"], cwd=base_dir, text=True).strip()
        if b:
            branch = b
    except Exception:
        pass

    return repo_slug, branch

def purge_cdn():
    print_out("=================================================")
    print_out(" INICIANDO PURGA DE CACHE CDN (jsDelivr)")
    print_out("=================================================")
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    repo_slug, branch = get_repo_info(base_dir)
    print_out(f"[INFO] Repositorio detectado: {repo_slug} (rama: {branch})")
    carpetas_validas = []
    
    # Descubrir carpetas
    for item in os.listdir(base_dir):
        item_path = os.path.join(base_dir, item)
        if os.path.isdir(item_path):
            if os.path.isdir(os.path.join(item_path, "audios")):
                carpetas_validas.append(item)
                
    # Filtrar si el usuario solicitó una carpeta específica
    if len(sys.argv) > 1:
        target = sys.argv[1].strip()
        if target and target != "*" and target.lower() != "todas":
            if target in carpetas_validas:
                carpetas_validas = [target]
            else:
                print_out(f"[ERROR] La carpeta '{target}' no existe o no tiene audios.")
                return

    if not carpetas_validas:
        print_out("[!] No se encontraron carpetas con audios en el repositorio.")
        return
        
    exitos = 0
    fallos = 0
        
    for folder in carpetas_validas:
        url = f"https://purge.jsdelivr.net/gh/{repo_slug}@{branch}/{folder}/ringtones.json"
        print_out(f"\n---> Purgando cache para: {folder}")
        print_out(f"URL: {url}")
        
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "unknown")
                if status == "finished":
                    print_out(f"  [OK] Cache purgada con exito.")
                    exitos += 1
                else:
                    print_out(f"  [AVISO] Respuesta inesperada: {data}")
                    fallos += 1
            else:
                print_out(f"  [ERROR] La API devolvio el codigo: {response.status_code}")
                fallos += 1
        except Exception as e:
            print_out(f"  [ERROR EXCEPCION] {str(e)}")
            fallos += 1
            
    print_out("\n=================================================")
    print_out(f" RESUMEN DE PURGA:")
    print_out(f" - Exitosas: {exitos}")
    print_out(f" - Fallidas: {fallos}")
    print_out("=================================================")

if __name__ == "__main__":
    purge_cdn()
