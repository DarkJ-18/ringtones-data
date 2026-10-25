import os
import sys
import shutil
import time
import threading
import webbrowser
import hashlib
import json
import math
import concurrent.futures
import re
import subprocess
import traceback
from flask import Flask, request, jsonify, render_template

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Hexagonal architecture imports
from hex_core.domain.profile import Profile
from hex_core.infrastructure.repositories.json_profile_repository import JsonProfileRepository
from hex_core.application.profile_service import ProfileService
from hex_core.infrastructure.adapters.script_runner import ScriptRunner

import yt_dlp
from pydub import AudioSegment
from pydub.effects import speedup

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__, 
            template_folder=os.path.join(base_dir, 'templates'), 
            static_folder=os.path.join(base_dir, 'static'))

APP_URL = "http://127.0.0.1:5000"
job_status = {
    "logs": [],
    "is_processing": False,
    "abort_requested": False,
    "task_results": [],
    "start_time": 0,
    "elapsed_seconds": 0
}
CACHE_BASE = os.path.join(base_dir, ".cache")
PREVIEW_FOLDER = os.path.join(CACHE_BASE, "previews")
CACHE_FOLDER = os.path.join(CACHE_BASE, "raw_cache")
TEMP_DOWNLOADS = os.path.join(CACHE_BASE, "temp_downloads")

# Initialize Domain Services
profile_repo = JsonProfileRepository(os.path.join(base_dir, "profiles.json"))
profile_service = ProfileService(profile_repo)
venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
script_runner = ScriptRunner(base_dir, venv_python)

def startup_cleanup():
    print("🧹 Iniciando limpieza de arranque...")
    os.makedirs(CACHE_FOLDER, exist_ok=True)
    for folder in [PREVIEW_FOLDER, TEMP_DOWNLOADS]:
        if os.path.exists(folder):
            try:
                shutil.rmtree(folder)
            except Exception as e:
                print(f"No se pudo limpiar {folder}: {e}")
        os.makedirs(folder, exist_ok=True)
    print("✅ Carpetas inicializadas.")

startup_cleanup()

@app.route("/api/clear_cache", methods=["POST"])
def clear_cache_api():
    try:
        startup_cleanup()
        return jsonify({"status": "Caché limpiada con éxito."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/folders", methods=["GET"])
def get_folders():
    try:
        ignore_dirs = {
            ".git", ".venv", ".cache", ".vscode", "scripts", "static", "templates",
            ".agents", "__pycache__", "hex_core", ".system_generated"
        }
        folders = []
        for entry in os.scandir(base_dir):
            if entry.is_dir() and entry.name.lower() not in ignore_dirs and not entry.name.startswith("."):
                folders.append(entry.name)
        folders.sort(key=lambda s: s.lower())
        return jsonify({"folders": folders})
    except Exception as e:
        return jsonify({"error": str(e), "folders": []}), 500

@app.route("/api/folders", methods=["POST"])
def create_folder():
    try:
        data = request.json or {}
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"error": "El nombre de la carpeta no puede estar vacío."}), 400
        
        # Normalizar nombre seguro para carpetas
        safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', name).strip('_').lower()
        if not safe_name:
            return jsonify({"error": "Nombre de carpeta no válido."}), 400
            
        target_path = os.path.join(base_dir, safe_name)
        os.makedirs(target_path, exist_ok=True)
        os.makedirs(os.path.join(target_path, "images"), exist_ok=True)
        return jsonify({"success": True, "folder": safe_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/open_folder", methods=["POST"])
def open_folder():
    try:
        data = request.json or {}
        folder = data.get("folder", "").strip()
        safe_folder = re.sub(r'[^a-zA-Z0-9_\-]', '', folder).strip()
        
        target_dir = os.path.join(base_dir, safe_folder) if safe_folder else base_dir
        if not os.path.exists(target_dir):
            return jsonify({"error": f"La carpeta '{safe_folder}' no existe."}), 404
            
        json_file = os.path.join(target_dir, "ringtones.json")
        
        if sys.platform == "win32":
            if os.path.exists(json_file):
                # Abre el Explorador y selecciona/resalta exactamente ringtones.json
                subprocess.Popen(f'explorer /select,"{os.path.normpath(json_file)}"')
            else:
                subprocess.Popen(f'explorer "{os.path.normpath(target_dir)}"')
        else:
            subprocess.Popen(["xdg-open", target_dir])
            
        return jsonify({"success": True, "folder": safe_folder or "raíz", "has_json": os.path.exists(json_file)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/get_catalog_json/<folder>", methods=["GET"])
def get_catalog_json_raw(folder):
    try:
        safe_folder = re.sub(r'[^a-zA-Z0-9_\-]', '', folder).strip()
        json_file = os.path.join(base_dir, safe_folder, "ringtones.json")
        if not os.path.exists(json_file):
            return jsonify({"error": f"No se encontró ringtones.json en {safe_folder}."}), 404
            
        with open(json_file, "r", encoding="utf-8-sig") as f:
            content = f.read()
        return jsonify({"success": True, "folder": safe_folder, "content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def parse_time_to_ms(time_str) -> int:
    if time_str is None:
        return 0
    time_str = str(time_str).strip().lower().replace("s", "")
    if not time_str:
        return 0
    try:
        if ":" in time_str:
            parts = [float(p) for p in time_str.split(":")]
            if len(parts) == 3:
                return int((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000)
            elif len(parts) == 2:
                return int((parts[0] * 60 + parts[1]) * 1000)
        return int(float(time_str) * 1000)
    except:
        return 0

def resolve_time_bounds_ms(start_val, dur_or_end_val, default_duration_sec=30):
    start_ms = parse_time_to_ms(start_val)
    raw_end = str(dur_or_end_val or "").strip().lower().replace("s", "")
    parsed_ms = parse_time_to_ms(raw_end)
    
    if parsed_ms <= 0:
        return start_ms, default_duration_sec * 1000

    # Si se especificó con formato de reloj ':' (ej: "2:00", "01:15") y es mayor que start,
    # el usuario indicó una marca de tiempo final de reloj.
    if ":" in raw_end and parsed_ms > start_ms:
        dur_ms = parsed_ms - start_ms
    else:
        # Si es un número plano de segundos (ej: "30", "45") o duración ya calculada por el front,
        # representa directamente la duración deseada.
        dur_ms = parsed_ms
            
    if dur_ms <= 0:
        dur_ms = default_duration_sec * 1000
        
    return start_ms, dur_ms

def add_log(msg):
    job_status["logs"].append(msg)
    try:
        print(msg)
    except Exception:
        pass

def sanitize_youtube_url(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    # Si contiene watch?v=, extraer solo hasta el ID del video (11 caracteres)
    if "watch?v=" in url:
        m = re.search(r'(https?://[^/]+/watch\?v=[a-zA-Z0-9_-]{11})', url)
        if m:
            return m.group(1)
    elif "youtu.be/" in url:
        m = re.search(r'(https?://youtu\.be/[a-zA-Z0-9_-]{11})', url)
        if m:
            return m.group(1)
    elif "shorts/" in url:
        m = re.search(r'(https?://[^/]+/shorts/[a-zA-Z0-9_-]{11})', url)
        if m:
            return m.group(1)
    return url

def clean_youtube_title(title_str):
    fluff_patterns = [
        r'\b(official|oficial)\b.*?(video|audio|music video|hd video|lyric video|clip|visualizer)',
        r'\b(music video|lyric video|audio oficial|video oficial|official hd video|4k|hd|hq)\b',
        r'\[.*?\]',
        r'\(.*?(official|oficial|video|audio|hd|4k|lyric|live).*?\)',
        r'\(.*?\)'
    ]
    cleaned = title_str
    for pattern in fluff_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = cleaned.strip('-').strip()
    return cleaned

def extract_title_and_artist(youtube_title):
    title = youtube_title.strip()
    if ' - ' in title:
        parts = title.split(' - ', 1)
        artist = parts[0].strip()
        song = parts[1].strip()
        return clean_youtube_title(song), clean_youtube_title(artist)
    return clean_youtube_title(title), ""

def get_js_runtimes():
    node_path = shutil.which("node")
    if node_path:
        return {"node": {"path": node_path}}
    return None

def setup_ffmpeg():
    ffmpeg_system = shutil.which("ffmpeg")
    if ffmpeg_system:
        ffmpeg_dir = os.path.dirname(ffmpeg_system)
        AudioSegment.converter = ffmpeg_system
        ffprobe_system = shutil.which("ffprobe")
        if ffprobe_system:
            AudioSegment.ffprobe = ffprobe_system
        return ffmpeg_dir
    
    winget_path = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Links")
    if os.path.exists(winget_path) and os.path.exists(os.path.join(winget_path, "ffmpeg.exe")):
        os.environ["PATH"] = winget_path + os.pathsep + os.environ.get("PATH", "")
        AudioSegment.converter = os.path.join(winget_path, "ffmpeg.exe")
        AudioSegment.ffprobe = os.path.join(winget_path, "ffprobe.exe")
        return winget_path
    return ""

def apply_8d_panning(cancion, period_sec=8, intensity=0.4):
    if cancion.channels == 1:
        cancion = cancion.set_channels(2)
    chunk_length_ms = 100
    chunks = []
    for i in range(0, len(cancion), chunk_length_ms):
        chunk = cancion[i:i+chunk_length_ms]
        t_sec = i / 1000.0
        pan_val = math.sin((2 * math.pi * t_sec) / period_sec) * intensity
        chunks.append(chunk.pan(pan_val).raw_data)
    return cancion._spawn(b''.join(chunks))

def apply_anti_copyright_effects(cancion, pitch, bass, pan, pan_dinamico=False):
    if pitch != 0:
        new_sample_rate = int(cancion.frame_rate * (2.0 ** (pitch / 12.0)))
        cancion = cancion._spawn(cancion.raw_data, overrides={"frame_rate": new_sample_rate}).set_frame_rate(cancion.frame_rate)
        
    if bass > 0:
        cancion_atenuada = cancion - (bass / 2.0)
        lows = cancion_atenuada.low_pass_filter(150)
        boosted_lows = lows + bass
        cancion = cancion_atenuada.overlay(boosted_lows).normalize()

    if pan_dinamico:
        cancion = apply_8d_panning(cancion)
    elif pan != 0:
        cancion = cancion.pan(pan)
        
    return cancion

def get_cached_audio(url, ffmpeg_path, js_runtimes, log_func=print):
    url = sanitize_youtube_url(url)
    url_hash = hashlib.md5(url.encode()).hexdigest()
    cached_file = os.path.join(CACHE_FOLDER, f"{url_hash}.mp3")
    meta_path = os.path.join(CACHE_FOLDER, f"{url_hash}.json")
    
    if os.path.exists(cached_file) and os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            log_func(f"⚡ [Caché] Reutilizando audio crudo para: {meta.get('title', 'Unknown')}")
            return cached_file, meta.get("title", "Unknown")
        except Exception as e:
            log_func(f"⚠️ Caché corrupta, descargando de nuevo: {e}")
            
    try:
        log_func(f"📥 Descargando audio original: {url}")
    except Exception:
        pass

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
        "outtmpl": {"default": os.path.join(CACHE_FOLDER, f"{url_hash}.%(ext)s")},
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "noplaylist": True,
        "extractor_args": {"youtube": {"player_client": ["android", "web"]}}
    }
    if js_runtimes:
        ydl_opts["js_runtimes"] = js_runtimes
        ydl_opts["remote_components"] = ["ejs:github"]
    if os.path.exists(ffmpeg_path):
        ydl_opts["ffmpeg_location"] = ffmpeg_path
        
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if not info:
            raise Exception("No se pudo extraer información.")
        if 'entries' in info and len(info['entries']) > 0:
            title = info['entries'][0].get("title", "Unknown")
        else:
            title = info.get("title", "Unknown")
            
    if not os.path.exists(cached_file):
        raise Exception("La descarga falló silenciosamente (puede que el video esté bloqueado o restringido por edad).")
        
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"title": title}, f)
        
    return cached_file, title

# -- Funciones de DB JSON --
db_lock = threading.Lock()

def update_json_db(folder_path, folder_name, song_title, song_artist, audio_filename, poster_filename=""):
    json_path = os.path.join(folder_path, "ringtones.json")
    
    with db_lock:
        data = []
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8-sig") as f:
                    content = f.read().strip()
                    if content:
                        data = json.loads(content)
            except Exception as e:
                add_log(f"⚠️ Error leyendo {json_path}: {e}")
                add_log("🛑 Abortando actualización para no sobrescribir y perder la lista actual.")
                return False
        # Find max ID
        max_id = 0
        for item in data:
            try:
                curr_id = int(item.get("id", 0))
                if curr_id > max_id: max_id = curr_id
            except:
                pass
                
        new_id = str(max_id + 1)
        audio_path_db = f"audios/{audio_filename}"
        poster_path_db = f"images/{poster_filename}" if poster_filename else ""
        
        # Check if already exists by audioPath
        for item in data:
            if item.get("audioPath") == audio_path_db:
                # Si se subió foto y antes no tenía o es nueva, actualizar el posterPath
                if poster_path_db and item.get("posterPath") != poster_path_db:
                    item["posterPath"] = poster_path_db
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=4, ensure_ascii=False)
                    return True
                return False # Ya existe en el JSON
        
        new_entry = {
            "id": new_id,
            "title": song_title,
            "subtitle": song_artist,
            "audioPath": audio_path_db,
            "posterPath": poster_path_db
        }
        data.append(new_entry)
        
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        return True

def process_single_task(task, folder_name, ffmpeg_path, js_runtimes, force_overwrite=False):
    if job_status.get("abort_requested"):
        return {"status": "skipped", "task": task}
        
    url = task.get("url", "").strip()
    if not url:
        return {"status": "skipped", "task": task}
        
    start_ms, dur_ms = resolve_time_bounds_ms(task.get("start", "0:00"), task.get("duration", "0:30"), default_duration_sec=30)
    speed = float(task.get("speed", 1.0))
    pitch = float(task.get("pitch", 0.0))
    bass = float(task.get("bass", 0.0))
    pan = float(task.get("pan", 0.0))
    pan_dinamico = bool(task.get("pan_dinamico", False))
    
    try:
        filename_mp3, raw_title = get_cached_audio(url, ffmpeg_path, js_runtimes, log_func=lambda msg: None)
        add_log(f"Procesando: {raw_title}")
        
        cancion = AudioSegment.from_file(filename_mp3)
        end_ms = start_ms + dur_ms if dur_ms > 0 else len(cancion)
        if start_ms > 0 or dur_ms > 0: cancion = cancion[start_ms:end_ms]
        if speed > 1.0: cancion = speedup(cancion, playback_speed=speed)
        cancion = apply_anti_copyright_effects(cancion, pitch, bass, pan, pan_dinamico)
        
        fade_in_ms = int(task.get("fade_in", 0)) * 1000
        fade_out_ms = int(task.get("fade_out", 0)) * 1000
        if fade_in_ms > 0: cancion = cancion.fade_in(fade_in_ms)
        if fade_out_ms > 0: cancion = cancion.fade_out(fade_out_ms)
        
        song, artist = extract_title_and_artist(raw_title)
        req_artist = task.get("artist", "").strip()
        req_title = task.get("title", "").strip()
        if req_artist: artist = req_artist
        if req_title: song = req_title
        
        if artist and song: final_name = f"{artist} - {song}.mp3"
        elif song: final_name = f"{song}.mp3"
        else: final_name = f"{raw_title}.mp3"
            
        final_name = final_name.lower()
        final_name = final_name.replace(" - ", "-").replace(" ", "-")
        for k, v in zip("áàäâéèëêíìïîóòöôúùüûñ", "aaaaeeeeiiiioooouuuun"):
            final_name = final_name.replace(k, v)
        final_name = re.sub(r'[^a-z0-9\.-]', '', final_name)
        final_name = re.sub(r'-+', '-', final_name)
        if not final_name.endswith(".mp3"): final_name += ".mp3"
        
        # Estructura del folder: Github/<folder_name>/audios/
        safe_folder = "".join([c for c in folder_name if c.isalpha() or c.isdigit() or c in ' -_']).strip()
        if not safe_folder: safe_folder = "general"
        
        target_folder = os.path.join(base_dir, safe_folder)
        audios_folder = os.path.join(target_folder, "audios")
        images_folder = os.path.join(target_folder, "images")
        os.makedirs(audios_folder, exist_ok=True)
        os.makedirs(images_folder, exist_ok=True)
        
        final_path = os.path.join(audios_folder, final_name)

        # Si el usuario solicitó abortar mientras se procesaba, salir sin guardar nada
        if job_status.get("abort_requested"):
            return {
                "status": "aborted",
                "task_id": task.get("task_id", ""),
                "url": url,
                "message": "Cancelado por el usuario"
            }

        # Manejo de la foto/imagen subida
        image_data = task.get("image_data", "").strip()
        poster_filename = ""
        if image_data and "," in image_data:
            try:
                import base64
                header, encoded = image_data.split(",", 1)
                img_bytes = base64.b64decode(encoded)

                # Validación de seguridad en el backend (peso y cabeceras mágicas)
                if len(img_bytes) < 50 or len(img_bytes) > 15 * 1024 * 1024:
                    raise Exception("Tamaño de imagen inválido")

                img_ext = "png"
                if img_bytes[:8] == b'\x89PNG\r\n\x1a\n':
                    img_ext = "png"
                elif img_bytes[:2] == b'\xff\xd8':
                    img_ext = "jpg"
                elif img_bytes[:4] == b'RIFF' and img_bytes[8:12] == b'WEBP':
                    img_ext = "webp"
                else:
                    raise Exception("Cabecera de imagen no reconocida")
                
                base_name = final_name.rsplit(".", 1)[0]
                poster_filename = f"{base_name}.{img_ext}"
                poster_path = os.path.join(images_folder, poster_filename)
                
                with open(poster_path, "wb") as img_file:
                    img_file.write(img_bytes)
                add_log(f"🖼️ Foto guardada ({img_ext.upper()} 512x512): {poster_filename}")
            except Exception as img_err:
                add_log(f"⚠️ Error validando/guardando foto: {str(img_err)}")
                poster_filename = ""

        # Chequeo final de abort antes de escribir en disco el audio definitivo
        if job_status.get("abort_requested"):
            if poster_filename and os.path.exists(os.path.join(images_folder, poster_filename)):
                try:
                    os.remove(os.path.join(images_folder, poster_filename))
                except Exception:
                    pass
            return {
                "status": "aborted",
                "task_id": task.get("task_id", ""),
                "url": url,
                "message": "Cancelado por el usuario"
            }

        task_id = task.get("task_id", "")
        if not force_overwrite and os.path.exists(final_path):
            add_log(f"⚠️ Omitida la descarga (ya existe audio en disco): {final_name}")
            db_updated = update_json_db(target_folder, safe_folder, song, artist, final_name, poster_filename)
            if db_updated:
                add_log(f"✅ Pero fue actualizada la base de datos (con foto o ID): {final_name}")
            return {
                "status": "skipped_existing",
                "task_id": task_id,
                "url": url,
                "final_name": final_name,
                "reason": "duplicate_in_catalog",
                "message": f"Ya existe en el catálogo ({final_name}). Si es otra parte o versión, cambia el título o activa 'Sobrescribir'."
            }

        cancion.export(final_path, format="mp3", bitrate="192k")
        
        # Chequeo antes de tocar la base de datos JSON
        if job_status.get("abort_requested"):
            if os.path.exists(final_path):
                try:
                    os.remove(final_path)
                except Exception:
                    pass
            return {
                "status": "aborted",
                "task_id": task_id,
                "url": url,
                "message": "Cancelado por el usuario"
            }

        # Update JSON DB
        db_updated = update_json_db(target_folder, safe_folder, song, artist, final_name, poster_filename)
        if db_updated:
            add_log(f"✅ DB actualizada y completado: {final_name}")
        else:
            add_log(f"✅ Audio guardado pero ya existía en DB: {final_name}")
            
        return {
            "status": "success",
            "task_id": task_id,
            "url": url,
            "final_name": final_name,
            "message": "Completada exitosamente"
        }
    except Exception as e:
        err_msg = str(e)
        add_log(f"❌ Error en {url}: {err_msg}")
        return {
            "status": "error",
            "task_id": task.get("task_id", ""),
            "url": url,
            "error": err_msg,
            "reason": "download_or_process_error",
            "message": f"Error: {err_msg[:120]}",
            "task": task
        }

def process_tasks(folder_name, tasks, force_overwrite=False):
    start_time = time.time()
    job_status["is_processing"] = True
    job_status["abort_requested"] = False
    job_status["start_time"] = start_time
    job_status["elapsed_seconds"] = 0
    job_status["task_results"] = []
    add_log("--- INICIANDO PROCESO BATCH WEB ---")

    total_tasks = 0
    success_count = 0
    error_count = 0
    skipped_existing_count = 0
    failed_items = []
    all_results = []
    
    ffmpeg_path = setup_ffmpeg()
    js_runtimes = get_js_runtimes()
        
    valid_tasks = [t for t in tasks if t.get("url", "").strip()]
    total_tasks = len(valid_tasks)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(process_single_task, task, folder_name, ffmpeg_path, js_runtimes, force_overwrite): task for task in valid_tasks}
        
        pendientes = set(futures.keys())
        while pendientes:
            job_status["elapsed_seconds"] = round(time.time() - start_time, 1)
            if job_status.get("abort_requested"):
                add_log("🛑 --- PROCESAMIENTO DETENIDO ---")
                for f in pendientes: f.cancel()
                break
                
            hechos, pendientes = concurrent.futures.wait(pendientes, timeout=1.0, return_when=concurrent.futures.FIRST_COMPLETED)
            
            for future in hechos:
                res = future.result()
                all_results.append(res)
                if res["status"] == "success": success_count += 1
                elif res["status"] == "skipped_existing": skipped_existing_count += 1
                elif res["status"] == "error":
                    error_count += 1
                    failed_items.append({"url": res.get("url", ""), "error": res.get("error", ""), "task": res.get("task", {})})

    elapsed = round(time.time() - start_time, 1)
    mins = int(elapsed // 60)
    secs = int(elapsed % 60)
    time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"

    add_log("--- RESUMEN DEL PROCESO ---")
    add_log(f"Total: {total_tasks} | Correctas: {success_count} | Errores: {error_count} | Existentes omitidas: {skipped_existing_count}")
    add_log(f"⏱️ Tiempo total del proceso: {time_str} ({elapsed}s)")
    
    job_status["is_processing"] = False
    job_status["elapsed_seconds"] = elapsed
    job_status["task_results"] = all_results
    job_status["failed_items"] = [item["task"] for item in failed_items]
    add_log("--- FINALIZADO ---")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/process", methods=["POST"])
def process_api():
    if job_status["is_processing"]:
        return jsonify({"error": "Trabajo en ejecución"}), 400
    data = request.json
    job_status["logs"] = []
    job_status["failed_items"] = []
    job_status["task_results"] = []
    job_status["abort_requested"] = False
    job_status["start_time"] = time.time()
    job_status["elapsed_seconds"] = 0
    threading.Thread(target=process_tasks, args=(data.get("folder", "general"), data.get("tasks", []), data.get("force_overwrite", False)), daemon=True).start()
    return jsonify({"status": "Iniciado"})

@app.route("/api/cancel", methods=["POST"])
def cancel_api():
    if not job_status["is_processing"]:
        return jsonify({"error": "No hay proceso activo"}), 400
    job_status["abort_requested"] = True
    return jsonify({"status": "Cancelación solicitada"})

@app.route("/api/status", methods=["GET"])
def status_api():
    current_elapsed = round(time.time() - job_status["start_time"], 1) if job_status["is_processing"] and job_status.get("start_time") else job_status.get("elapsed_seconds", 0)
    return jsonify({
        "is_processing": job_status["is_processing"],
        "logs": job_status["logs"],
        "elapsed_seconds": current_elapsed,
        "task_results": job_status.get("task_results", []),
        "failed_items": job_status.get("failed_items", [])
    })

def cleanup_old_previews():
    try:
        now = time.time()
        for filename in os.listdir(PREVIEW_FOLDER):
            file_path = os.path.join(PREVIEW_FOLDER, filename)
            if os.path.isfile(file_path) and (now - os.path.getmtime(file_path)) > 3600:
                os.remove(file_path)
    except: pass

@app.route("/api/preview", methods=["POST"])
def preview_api():
    threading.Thread(target=cleanup_old_previews, daemon=True).start()
    data = request.json
    url = sanitize_youtube_url(data.get("url", ""))
    if not url: return jsonify({"error": "URL requerida"}), 400

    try:
        import uuid
        preview_id = str(uuid.uuid4())[:8]
        preview_filename = f"preview_{preview_id}.mp3"
        preview_path = os.path.join(PREVIEW_FOLDER, preview_filename)

        ffmpeg_path = setup_ffmpeg()
        js_runtimes = get_js_runtimes()
        filename_mp3, _ = get_cached_audio(url, ffmpeg_path, js_runtimes, log_func=lambda msg: None)

        cancion = AudioSegment.from_file(filename_mp3)
        start_ms, dur_ms = resolve_time_bounds_ms(data.get("start", "0:00"), data.get("duration", "0:30"), default_duration_sec=30)
        speed = float(data.get("speed", 1.0))
        end_ms = start_ms + (dur_ms if dur_ms > 0 else 30000)
        cancion = cancion[start_ms:end_ms]
        if speed > 1.0: cancion = speedup(cancion, playback_speed=speed)

        pitch = float(data.get("pitch", 0.0))
        bass = float(data.get("bass", 0.0))
        pan = float(data.get("pan", 0.0))
        pan_dinamico = bool(data.get("pan_dinamico", False))
        cancion = apply_anti_copyright_effects(cancion, pitch, bass, pan, pan_dinamico)

        fade_in = int(data.get("fade_in", 0)) * 1000
        fade_out = int(data.get("fade_out", 0)) * 1000
        if fade_in > 0: cancion = cancion.fade_in(fade_in)
        if fade_out > 0: cancion = cancion.fade_out(fade_out)

        cancion.export(preview_path, format="mp3", bitrate="128k")
        # Se envía como endpoint dinámico local para servir la previa desde .cache
        return jsonify({"preview_url": f"/api/serve_preview/{preview_filename}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/serve_preview/<filename>")
def serve_preview(filename):
    from flask import send_from_directory
    return send_from_directory(PREVIEW_FOLDER, filename)

@app.route("/api/git_sync", methods=["POST"])
def git_sync_api():
    try:
        # Hacer git add .
        subprocess.run(["git", "add", "."], cwd=base_dir, check=True)
        # Hacer git commit -m "Auto update"
        res_commit = subprocess.run(["git", "commit", "-m", "Añadidas nuevas canciones desde Audio Architect"], cwd=base_dir)
        # Si no hay nada que hacer commit (todo estaba subido ya), git commit devuelve error exitoso o no, lo ignoramos, hacemos push igual.
        subprocess.run(["git", "push"], cwd=base_dir, check=True)
        return jsonify({"status": "Git Push exitoso"})
    except subprocess.CalledProcessError as e:
        return jsonify({"error": f"Error en Git: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- ENDPOINTS GESTOR DE CATÁLOGO / CANCIONES ---

CDN_REPO_BASE = "https://cdn.jsdelivr.net/gh/DeliaDevS2/ringtones-data@main"

@app.route("/api/catalog/<folder>", methods=["GET"])
def get_catalog_songs(folder):
    safe_folder = re.sub(r'[^a-zA-Z0-9_\-]', '', folder).strip()
    if not safe_folder:
        return jsonify({"error": "Carpeta inválida"}), 400
        
    folder_dir = os.path.join(base_dir, safe_folder)
    if not os.path.isdir(folder_dir):
        return jsonify({"error": f"La carpeta '{safe_folder}' no existe."}), 404
        
    json_path = os.path.join(folder_dir, "ringtones.json")
    if not os.path.isfile(json_path):
        return jsonify({"folder": safe_folder, "songs": [], "has_json": False})
        
    with db_lock:
        try:
            with open(json_path, "r", encoding="utf-8-sig") as f:
                content = f.read().strip()
                songs = json.loads(content) if content else []
        except Exception as e:
            return jsonify({"error": f"Error leyendo ringtones.json: {str(e)}", "songs": []}), 500

    enriched = []
    for item in songs:
        song_id = str(item.get("id", ""))
        audio_rel = item.get("audioPath", "")
        poster_rel = item.get("posterPath", "")
        
        # 1. Comprobar existencia física local
        audio_full = os.path.join(folder_dir, audio_rel.replace("/", os.sep)) if audio_rel else ""
        poster_full = os.path.join(folder_dir, poster_rel.replace("/", os.sep)) if poster_rel else ""
        
        has_local_audio = bool(audio_full and os.path.isfile(audio_full))
        has_local_poster = bool(poster_full and os.path.isfile(poster_full))
        
        # 2. URLs de audio e imagen (Fallback transparente a CDN si no está en local)
        if has_local_audio:
            audio_url = f"/api/media/{safe_folder}/{audio_rel}"
            audio_source = "local"
            audio_size_kb = round(os.path.getsize(audio_full) / 1024, 1)
        elif audio_rel:
            audio_url = f"{CDN_REPO_BASE}/{safe_folder}/{audio_rel}"
            audio_source = "cdn"
            audio_size_kb = 0
        else:
            audio_url = ""
            audio_source = "none"
            audio_size_kb = 0

        if has_local_poster:
            poster_url = f"/api/media/{safe_folder}/{poster_rel}"
            poster_source = "local"
        elif poster_rel:
            poster_url = f"{CDN_REPO_BASE}/{safe_folder}/{poster_rel}"
            poster_source = "cdn"
        else:
            poster_url = ""
            poster_source = "none"
        
        enriched.append({
            "id": song_id,
            "title": item.get("title", ""),
            "subtitle": item.get("subtitle", ""),
            "audioPath": audio_rel,
            "posterPath": poster_rel,
            "has_audio": bool(audio_url),
            "has_local_audio": has_local_audio,
            "audio_source": audio_source,
            "has_poster": bool(poster_url),
            "has_local_poster": has_local_poster,
            "poster_source": poster_source,
            "audio_size_kb": audio_size_kb,
            "audio_url": audio_url,
            "poster_url": poster_url
        })

    return jsonify({"folder": safe_folder, "songs": enriched, "has_json": True, "total": len(enriched)})

@app.route("/api/media/<folder>/<path:filename>")
def serve_media(folder, filename):
    from flask import send_from_directory
    safe_folder = re.sub(r'[^a-zA-Z0-9_\-]', '', folder).strip()
    folder_dir = os.path.join(base_dir, safe_folder)
    return send_from_directory(folder_dir, filename)

@app.route("/api/catalog/<folder>/<song_id>", methods=["PUT"])
def edit_catalog_song(folder, song_id):
    safe_folder = re.sub(r'[^a-zA-Z0-9_\-]', '', folder).strip()
    data = request.json or {}
    new_title = data.get("title", "").strip()
    new_subtitle = data.get("subtitle", "").strip()
    image_data = data.get("image_data", "").strip()
    remove_image = bool(data.get("remove_image", False))
    
    if not new_title:
        return jsonify({"error": "El título no puede estar vacío."}), 400
        
    folder_dir = os.path.join(base_dir, safe_folder)
    json_path = os.path.join(folder_dir, "ringtones.json")
    if not os.path.isfile(json_path):
        return jsonify({"error": "No existe ringtones.json en esta carpeta."}), 404

    with db_lock:
        try:
            with open(json_path, "r", encoding="utf-8-sig") as f:
                songs = json.loads(f.read().strip() or "[]")
        except Exception as e:
            return jsonify({"error": f"Error leyendo ringtones.json: {str(e)}"}), 500

        target_song = None
        for s in songs:
            if str(s.get("id")) == str(song_id):
                target_song = s
                break
                
        if not target_song:
            return jsonify({"error": f"Canción con ID {song_id} no encontrada."}), 404

        # Copia de respaldo automática (.bak)
        try:
            shutil.copyfile(json_path, f"{json_path}.bak")
        except Exception:
            pass

        target_song["title"] = new_title
        target_song["subtitle"] = new_subtitle

        # Manejo de imagen
        if remove_image:
            target_song["posterPath"] = ""
        elif image_data and "," in image_data:
            try:
                import base64
                header, encoded = image_data.split(",", 1)
                img_bytes = base64.b64decode(encoded)
                images_dir = os.path.join(folder_dir, "images")
                os.makedirs(images_dir, exist_ok=True)
                
                existing_audio = target_song.get("audioPath", "")
                if existing_audio:
                    base_name = os.path.splitext(os.path.basename(existing_audio))[0]
                else:
                    base_name = f"song_{song_id}"
                img_name = f"{base_name}.png"
                img_path = os.path.join(images_dir, img_name)
                with open(img_path, "wb") as f_img:
                    f_img.write(img_bytes)
                target_song["posterPath"] = f"images/{img_name}"
            except Exception as e:
                add_log(f"⚠️ Error actualizando imagen: {e}")

        # Guardar JSON
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(songs, f, indent=4, ensure_ascii=False)
        except Exception as e:
            return jsonify({"error": f"Error guardando cambios: {str(e)}"}), 500

    return jsonify({"success": True, "song": target_song})

@app.route("/api/catalog/<folder>/<song_id>", methods=["DELETE"])
def delete_catalog_song(folder, song_id):
    safe_folder = re.sub(r'[^a-zA-Z0-9_\-]', '', folder).strip()
    data = request.json or {}
    delete_files = bool(data.get("delete_files", True))
    
    folder_dir = os.path.join(base_dir, safe_folder)
    json_path = os.path.join(folder_dir, "ringtones.json")
    if not os.path.isfile(json_path):
        return jsonify({"error": "No existe ringtones.json en esta carpeta."}), 404

    with db_lock:
        try:
            with open(json_path, "r", encoding="utf-8-sig") as f:
                songs = json.loads(f.read().strip() or "[]")
        except Exception as e:
            return jsonify({"error": f"Error leyendo ringtones.json: {str(e)}"}), 500

        target_song = None
        remaining_songs = []
        for s in songs:
            if str(s.get("id")) == str(song_id):
                target_song = s
            else:
                remaining_songs.append(s)
                
        if not target_song:
            return jsonify({"error": f"Canción con ID {song_id} no encontrada."}), 404

        # Copia de respaldo (.bak)
        try:
            shutil.copyfile(json_path, f"{json_path}.bak")
        except Exception:
            pass

        deleted_audio = False
        deleted_poster = False
        if delete_files:
            audio_rel = target_song.get("audioPath", "")
            if audio_rel:
                audio_full = os.path.join(folder_dir, audio_rel.replace("/", os.sep))
                if os.path.isfile(audio_full):
                    try:
                        os.remove(audio_full)
                        deleted_audio = True
                    except Exception as e:
                        add_log(f"⚠️ No se pudo eliminar archivo de audio: {e}")

            poster_rel = target_song.get("posterPath", "")
            if poster_rel:
                poster_full = os.path.join(folder_dir, poster_rel.replace("/", os.sep))
                if os.path.isfile(poster_full):
                    try:
                        os.remove(poster_full)
                        deleted_poster = True
                    except Exception as e:
                        add_log(f"⚠️ No se pudo eliminar archivo de foto: {e}")

        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(remaining_songs, f, indent=4, ensure_ascii=False)
        except Exception as e:
            return jsonify({"error": f"Error guardando ringtones.json tras borrado: {str(e)}"}), 500

    return jsonify({
        "success": True,
        "deleted_id": song_id,
        "deleted_audio_file": deleted_audio,
        "deleted_poster_file": deleted_poster,
        "remaining_count": len(remaining_songs)
    })

# --- NUEVOS ENDPOINTS HEXAGONALES ---

@app.route("/api/profiles", methods=["GET"])
def get_profiles():
    return jsonify(profile_service.list_profiles())

@app.route("/api/profiles", methods=["POST"])
def save_profile():
    data = request.json
    try:
        updated_profile = profile_service.create_or_update_profile(data)
        return jsonify(updated_profile)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/profiles/<profile_id>", methods=["DELETE"])
def delete_profile(profile_id):
    try:
        profile_service.delete_profile(profile_id)
        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/run_script", methods=["POST"])
def run_script():
    data = request.json
    script_name = data.get("script")
    profile_id = data.get("profile_id")
    
    # Validar el script permitido
    allowed_scripts = {
        "airtable": "Scripts/descargar_canciones_airtable.py",
        "baserow": "Scripts/descargar_canciones_baserow.py",
        "exportar": "Scripts/exportar_catalogo.py",
        "subir_github": "Scripts/subir_github.py",
        "purgar_cdn": "Scripts/purgar_cdn.py"
    }
    
    if script_name not in allowed_scripts:
        return jsonify({"error": "Script no permitido o desconocido"}), 400
        
    script_path = allowed_scripts[script_name]
    
    # Preparar las variables de entorno si se usa un perfil (Para inyección dinámica)
    env_vars = {}
    if profile_id:
        profile = profile_service.get_profile(profile_id)
        if profile:
            env_vars = {
                "AIRTABLE_TOKEN": profile.airtable_token,
                "AIRTABLE_BASE_ID": profile.airtable_base_id,
                "AIRTABLE_TABLE_ID": profile.airtable_table_id,
                "BASEROW_TOKEN": profile.baserow_token,
                "TABLE_ID": profile.baserow_table_id,
                "DOWNLOAD_FOLDER_AIRTABLE": profile.download_folder_airtable,
                "DOWNLOAD_FOLDER_BASEROW": profile.download_folder_baserow,
                "TARGET_FOLDER": profile.target_folder,
                "COL_ARTIST": profile.col_artist,
                "COL_TITLE": profile.col_title,
                "COL_AUDIO": profile.col_audio,
                "COL_ICON": profile.col_icon,
                "FILENAME_FORMAT": getattr(profile, "filename_format", "artista_titulo")
            }
            
    # Para scripts que requieran input interactivo (como exportar_catalogo.py)
    # se debe pasar el input mediante argumentos o evitar el input()
    # Para exportar_catalogo.py y purgar_cdn.py leemos sys.argv
    args = []
    if script_name == "exportar":
        genero = data.get("genero", "")
        if not genero:
            return jsonify({"error": "Debes especificar el género a exportar"}), 400
        args = [genero]
    elif script_name == "purgar_cdn":
        target = data.get("target", "")
        if target:
            args = [target]
        
    # Ejecutar de forma asíncrona
    try:
        task_id = script_runner.start_script(script_path, env_vars=env_vars, args=args)
        return jsonify({
            "status": "started",
            "task_id": task_id
        })
    except Exception as e:
        return jsonify({"error": str(e), "log": traceback.format_exc()}), 500

@app.route("/api/script_status/<task_id>", methods=["GET"])
def script_status(task_id):
    status = script_runner.get_status(task_id)
    if not status:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({
        "status": status["status"],
        "logs": status["logs"],
        "returncode": status.get("returncode")
    })

@app.route("/api/cancel_script/<task_id>", methods=["POST"])
def cancel_script(task_id):
    script_runner.cancel_script(task_id)
    return jsonify({"status": "cancelled"})


if __name__ == "__main__":
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    threading.Timer(1.0, lambda: webbrowser.open(APP_URL)).start()
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
